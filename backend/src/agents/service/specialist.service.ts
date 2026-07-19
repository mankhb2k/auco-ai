import { Injectable, Logger } from '@nestjs/common';
import type { AgentRole } from '../agent-catalog';
import { ActorsService } from '../../actors/service/actors.service';
import { LlmGatewayService } from '../../llm/llm.gateway';
import { McpGatewayService } from '../../mcp-client/service/mcp-gateway.service';
import type { TaskStepPlan } from '../../planning/task-plan.schema';
import { RagService } from '../../rag/service/rag.service';

export type PendingApproval = {
  reason: 'mutates' | 'out_of_portfolio_access';
  preview: string;
  tool: string;
  args: Record<string, unknown>;
  agentRole: AgentRole;
  mcp?: string;
  capability?: string;
};

export type SpecialistResult = {
  output: Record<string, unknown>;
  toolCalls: Array<Record<string, unknown>>;
  mode: 'direct' | 'spawn_workers';
  pendingApproval?: PendingApproval;
};

const ROLE_LABEL: Record<string, string> = {
  credit: 'Tín dụng (thẩm định)',
  legal: 'Pháp lý / Tuân thủ',
  collateral: 'Tài sản bảo đảm',
  product: 'Sản phẩm',
  ops: 'Vận hành',
};

@Injectable()
export class SpecialistService {
  private readonly logger = new Logger(SpecialistService.name);

  constructor(
    private readonly mcp: McpGatewayService,
    private readonly rag: RagService,
    private readonly actors: ActorsService,
    private readonly llm: LlmGatewayService,
  ) {}

  async run(
    step: TaskStepPlan,
    ctx: {
      goal: string;
      bankCode?: string;
      priorOutputs: Record<string, unknown>;
      /** Phase 9 compare: finish DAG without parking on mutate propose */
      skipApprovalPropose?: boolean;
      /** Phase 9 baseline: one generalist with full tools, no Planner */
      baseline?: boolean;
      /** Actor tạo TaskRun — scope portfolio */
      employeeId?: string;
      /** CustomerNo đã được manager cấp quyền ngoài danh mục */
      portfolioGrants?: string[];
    },
  ): Promise<SpecialistResult> {
    const bankCode = ctx.bankCode ?? 'SHB';
    const customer = this.extractCustomerHints(ctx.goal, step.goal);

    if (ctx.employeeId && customer.customerNo && !ctx.baseline) {
      const allowed = await this.actors.isCustomerInPortfolio(
        ctx.employeeId,
        customer.customerNo,
        ctx.portfolioGrants ?? [],
      );
      if (!allowed) {
        return this.parkOutOfPortfolio(step, customer);
      }
    }

    if (ctx.baseline) {
      return this.runBaseline(bankCode, customer, step, ctx.goal);
    }

    const role = step.agentRole as AgentRole;
    const mode =
      step.mode ?? (role === 'credit' ? 'spawn_workers' : 'direct');

    if (mode === 'spawn_workers' && role === 'credit') {
      return this.runCreditWorkers(
        bankCode,
        customer,
        step,
        ctx.goal,
        ctx.skipApprovalPropose,
      );
    }

    if (role === 'legal') {
      return this.runLegal(
        bankCode,
        customer,
        step,
        ctx.goal,
        ctx.skipApprovalPropose,
      );
    }
    if (role === 'collateral') {
      return this.runCollateral(bankCode, customer, step, ctx.goal);
    }
    if (role === 'product') {
      return this.runProduct(
        bankCode,
        customer,
        step,
        ctx.goal,
        ctx.priorOutputs,
      );
    }
    if (role === 'ops') {
      return this.runOps(bankCode, customer, step, ctx.skipApprovalPropose);
    }

    return this.runCreditWorkers(
      bankCode,
      customer,
      step,
      ctx.goal,
      ctx.skipApprovalPropose,
    );
  }

  /**
   * Chuyên gia phân tích dữ liệu tool/RAG bằng LLM → input cho agent tổng hợp.
   * Nếu thiếu key hoặc LLM lỗi thì fallback sang summary deterministic.
   */
  private async analyzeExpert(opts: {
    role: AgentRole;
    overallGoal: string;
    stepGoal: string;
    facts: Record<string, unknown>;
    fallbackSummary: string;
  }): Promise<{ analysis: string; usedLlm: boolean }> {
    if (!this.llm.isPrimaryConfigured && !this.llm.isFallbackConfigured) {
      return { analysis: opts.fallbackSummary, usedLlm: false };
    }

    const roleLabel = ROLE_LABEL[opts.role] ?? opts.role;
    try {
      const { text } = await this.llm.generateText({
        agentRole: opts.role,
        purpose: 'specialist',
        system: [
          `Bạn là chuyên gia ${roleLabel} của ngân hàng SHB.`,
          'Nhiệm vụ: phân tích dữ liệu tool/MCP và trích dẫn RAG đã thu thập,',
          'viết nhận định chuyên môn ngắn (3–8 câu) bằng tiếng Việt.',
          'Nêu rõ: kết luận trong phạm vi chuyên môn, căn cứ số liệu, rủi ro hoặc điểm chặn,',
          'và trích dẫn quy định nếu có (dạng: Trích dẫn: tên tài liệu — điều khoản).',
          'Không viết bản tổng hợp toàn hồ sơ — chỉ góc nhìn của chuyên gia này,',
          'để bước Planner phía sau tổng hợp các nhận định lại.',
          'Không bịa số liệu ngoài dữ liệu được cung cấp.',
        ].join(' '),
        prompt: [
          `Mục tiêu hồ sơ:\n${opts.overallGoal}`,
          `Nhiệm vụ bước:\n${opts.stepGoal}`,
          `Dữ liệu đã thu thập:\n${JSON.stringify(opts.facts, null, 2)}`,
          'Viết nhận định chuyên môn.',
        ].join('\n\n'),
      });
      const analysis = text.trim();
      if (!analysis) {
        return { analysis: opts.fallbackSummary, usedLlm: false };
      }
      this.logger.log(
        `Expert ${opts.role} analysis via LLM (${analysis.length} chars)`,
      );
      return { analysis, usedLlm: true };
    } catch (err) {
      this.logger.warn(
        `Expert ${opts.role} LLM analysis failed, using fallback: ${err instanceof Error ? err.message : err}`,
      );
      return { analysis: opts.fallbackSummary, usedLlm: false };
    }
  }

  /** README §2.7 — chặn MCP khi KH ngoài portfolio, xin duyệt manager. */
  private parkOutOfPortfolio(
    step: TaskStepPlan,
    customer: Record<string, string>,
  ): SpecialistResult {
    const customerNo = customer.customerNo!;
    const role = step.agentRole as AgentRole;
    const pendingApproval: PendingApproval = {
      reason: 'out_of_portfolio_access',
      preview: `Nhân viên xin truy cập KH ${customerNo} (${customer.fullName ?? 'ngoài danh mục'}) — ngoài CustomerPortfolio được giao.`,
      tool: 'grant_portfolio_access',
      agentRole: role,
      args: { customerNo, fullName: customer.fullName },
    };

    return {
      mode: 'direct',
      toolCalls: [
        {
          id: 'pending-portfolio',
          tool: pendingApproval.tool,
          mcp: 'policy',
          capability: 'portfolio',
          mutates: false,
          requiresApproval: true,
          status: 'pending_approval',
          reason: 'out_of_portfolio_access',
          args: pendingApproval.args,
        },
      ],
      pendingApproval,
      output: {
        summary: pendingApproval.preview,
        analysis: pendingApproval.preview,
        approvalReason: 'out_of_portfolio_access',
        approvalPreview: pendingApproval.preview,
        customerNo,
        stepGoal: step.goal,
      },
    };
  }

  /** Single-agent baseline: 1 step, full tools across domains, no allowlist, no Approval. */
  private async runBaseline(
    bankCode: string,
    customer: Record<string, string>,
    step: TaskStepPlan,
    goal: string,
  ): Promise<SpecialistResult> {
    const args = { bankCode, ...customer };
    const calls = await Promise.all([
      this.mcp.callTool({
        bankCode,
        agentRole: 'credit',
        tool: 'get_credit_score',
        args,
        skipAllowlist: true,
      }),
      this.mcp.callTool({
        bankCode,
        agentRole: 'legal',
        tool: 'run_aml_check',
        args,
        skipAllowlist: true,
      }),
      this.mcp.callTool({
        bankCode,
        agentRole: 'product',
        tool: 'compare_products',
        args: { purpose: goal, segment: 'retail' },
        skipAllowlist: true,
      }),
      this.mcp.callTool({
        bankCode,
        agentRole: 'credit',
        tool: 'list_products',
        args: {},
        skipAllowlist: true,
      }),
    ]);

    const kb = await this.rag.kbTool('legal_kb_search', {
      bankCode,
      query: goal.slice(0, 120),
      limit: 1,
    });

    const fallbackSummary = `Baseline single-agent: trả lời gộp Credit+Legal+Product trong 1 step (không Planner, không allowlist). Citation mỏng (${kb.citations.length}).`;
    const { analysis, usedLlm } = await this.analyzeExpert({
      role: 'credit',
      overallGoal: goal,
      stepGoal: step.goal,
      facts: {
        toolOutputs: calls.map((c) => ({ tool: c.tool, output: c.output })),
        citations: kb.citations,
      },
      fallbackSummary,
    });

    return {
      mode: 'direct',
      toolCalls: [
        ...calls.map((r, i) => ({
          id: `b${i + 1}`,
          tool: r.tool,
          mcp: r.mcp,
          capability: r.capability,
          mutates: r.mutates,
          latencyMs: r.latencyMs,
          baseline: true,
          domainCorrect: false,
          output: r.output,
        })),
        {
          id: 'b-rag',
          tool: kb.tool,
          mcp: 'rag',
          capability: 'rag',
          mutates: false,
          output: { summary: kb.summary, citations: kb.citations },
        },
      ],
      output: {
        summary: fallbackSummary,
        analysis,
        analysisUsedLlm: usedLlm,
        baseline: true,
        citations: kb.citations,
        stepGoal: step.goal,
      },
    };
  }

  private async runCreditWorkers(
    bankCode: string,
    customer: Record<string, string>,
    step: TaskStepPlan,
    overallGoal: string,
    skipApprovalPropose?: boolean,
  ): Promise<SpecialistResult> {
    const args = { bankCode, ...customer };
    const workers = [
      { id: 'w1', tool: 'get_credit_score' },
      { id: 'w2', tool: 'get_transaction_history' },
      { id: 'w3', tool: 'check_loan_eligibility' },
    ] as const;

    const results = await Promise.all(
      workers.map(async (w) => {
        const r = await this.mcp.callTool({
          bankCode,
          agentRole: 'credit',
          tool: w.tool,
          args: {
            ...args,
            ...(w.tool === 'check_loan_eligibility' && customer.requestedHint
              ? { requestedAmountVnd: Number(customer.requestedHint) }
              : {}),
          },
        });
        return { id: w.id, ...r };
      }),
    );

    const kb = await this.rag.kbTool('credit_kb_search', {
      bankCode,
      query:
        step.goal.includes('LTV') || step.goal.includes('nhà máy')
          ? 'LTV nhà xưởng DTI CIC'
          : 'DTI CIC hạn mức vay mua nhà',
      limit: 3,
      includeSuperseded: true,
    });

    const scoreOut = results[0]?.output as { score?: number } | undefined;
    const eligOut = results[2]?.output as
      | {
          eligible?: boolean;
          maxAmountVnd?: number;
          recommendation?: string;
        }
      | undefined;

    const amountVnd =
      Number(customer.requestedHint) ||
      eligOut?.maxAmountVnd ||
      1_600_000_000;

    const pendingApproval: PendingApproval | undefined = skipApprovalPropose
      ? undefined
      : {
          reason: 'mutates',
          preview: `Đề xuất gửi hồ sơ vay ${amountVnd.toLocaleString('vi-VN')} VND cho ${customer.customerNo ?? customer.fullName ?? 'KH'} qua mcp-los.submit_loan_application — chờ duyệt.`,
          tool: 'submit_loan_application',
          agentRole: 'credit',
          mcp: 'mcp-los-shb',
          capability: 'los',
          args: {
            bankCode,
            customerNo: customer.customerNo,
            customerId: customer.customerId,
            fullName: customer.fullName,
            amountVnd,
            productId: 'shb-home-standard',
            note: step.goal.slice(0, 200),
          },
        };

    const fallbackSummary = pendingApproval
      ? `${eligOut?.eligible ? 'Credit: đủ điều kiện sơ bộ' : 'Credit: cần review'} — điểm ${scoreOut?.score ?? '—'}; ${pendingApproval.preview}`
      : `${eligOut?.eligible ? 'Credit: đủ điều kiện sơ bộ' : 'Credit: cần review'} — điểm ${scoreOut?.score ?? '—'} (compare: bỏ qua propose mutate).`;

    const { analysis, usedLlm } = await this.analyzeExpert({
      role: 'credit',
      overallGoal,
      stepGoal: step.goal,
      facts: {
        customer,
        creditScore: results[0]?.output ?? null,
        transactionHistory: results[1]?.output ?? null,
        eligibility: results[2]?.output ?? null,
        citations: kb.citations,
        policySummary: kb.summary,
      },
      fallbackSummary,
    });

    return {
      mode: 'spawn_workers',
      toolCalls: [
        ...results.map((r) => ({
          id: r.id,
          tool: r.tool,
          mcp: r.mcp,
          capability: r.capability,
          mutates: r.mutates,
          bankCode: r.bankCode,
          latencyMs: r.latencyMs,
          domainCorrect: true,
          output: r.output,
        })),
        {
          id: 'w-rag',
          tool: kb.tool,
          mcp: 'rag',
          capability: 'rag',
          mutates: false,
          mode: kb.mode,
          domainCorrect: true,
          output: { summary: kb.summary, citations: kb.citations },
        },
        ...(pendingApproval
          ? [
              {
                id: 'pending-submit',
                tool: pendingApproval.tool,
                mcp: pendingApproval.mcp,
                capability: pendingApproval.capability,
                mutates: true,
                requiresApproval: true,
                status: 'pending_approval',
                domainCorrect: true,
                args: pendingApproval.args,
              },
            ]
          : [
              {
                id: 'compare-submit-skipped',
                tool: 'submit_loan_application',
                mcp: 'mcp-los-shb',
                capability: 'los',
                mutates: true,
                requiresApproval: true,
                status: 'skipped_for_compare',
                domainCorrect: true,
              },
            ]),
      ],
      pendingApproval,
      output: {
        summary: fallbackSummary,
        analysis,
        analysisUsedLlm: usedLlm,
        eligible: eligOut?.eligible ?? false,
        score: scoreOut?.score ?? null,
        maxAmountVnd: eligOut?.maxAmountVnd ?? null,
        recommendation: eligOut?.recommendation ?? 'refer_manual_review',
        workers: results.map((r) => r.id),
        citations: kb.citations,
        ...(pendingApproval
          ? {
              approvalReason: 'mutates',
              approvalPreview: pendingApproval.preview,
            }
          : {}),
        stepGoal: step.goal,
      },
    };
  }

  private async runLegal(
    bankCode: string,
    customer: Record<string, string>,
    step: TaskStepPlan,
    overallGoal: string,
    skipApprovalPropose?: boolean,
  ): Promise<SpecialistResult> {
    const aml = await this.mcp.callTool({
      bankCode,
      agentRole: 'legal',
      tool: 'run_aml_check',
      args: { bankCode, ...customer },
    });

    const kbQuery = step.goal.includes('39')
      ? 'Thông tư 39 LTV tài sản bảo đảm'
      : step.goal.toLowerCase().includes('fx') ||
          step.goal.toLowerCase().includes('ngoại')
        ? 'AML KYC ngoại tệ'
        : 'AML KYC cấp tín dụng';

    const kb = await this.rag.kbTool('legal_kb_search', {
      bankCode,
      query: kbQuery,
      limit: 3,
      includeSuperseded: false,
    });

    const reg = await this.mcp.callTool({
      bankCode,
      agentRole: 'legal',
      tool: 'search_regulation',
      args: { bankCode, query: kbQuery, limit: 3 },
    });

    const amlOut = aml.output as {
      status?: string;
      risk?: string;
      flags?: string[];
    };

    const topCite = kb.citations[0];
    const needsFlag =
      amlOut.status === 'review' ||
      amlOut.status === 'block' ||
      /fx|ngoại|usd/i.test(`${step.goal}`);

    const pendingApproval: PendingApproval | undefined =
      needsFlag && !skipApprovalPropose
        ? {
            reason: 'mutates',
            preview: `Đề xuất gắn cờ giao dịch / hồ sơ ${customer.customerNo ?? 'KH'} (AML ${amlOut.status}) qua mcp-compliance.flag_transaction — chờ duyệt.`,
            tool: 'flag_transaction',
            agentRole: 'legal',
            mcp: 'mcp-compliance-shb',
            capability: 'compliance',
            args: {
              bankCode,
              customerNo: customer.customerNo,
              fullName: customer.fullName,
              reason: `AML ${amlOut.status}: ${(amlOut.flags ?? []).join(', ') || step.goal.slice(0, 120)}`,
              currency: 'USD',
            },
          }
        : undefined;

    const skippedMutate =
      needsFlag && skipApprovalPropose
        ? {
            id: 'compare-flag-skipped',
            tool: 'flag_transaction',
            mcp: 'mcp-compliance-shb',
            capability: 'compliance',
            mutates: true,
            requiresApproval: true,
            status: 'skipped_for_compare',
            domainCorrect: true,
          }
        : null;

    const fallbackSummary = topCite
      ? `Legal: AML ${amlOut.status ?? 'unknown'} (risk ${amlOut.risk ?? '—'}); citation: ${topCite.sourceDoc} [${topCite.status}] score=${topCite.score.toFixed(3)}.${pendingApproval ? ` ${pendingApproval.preview}` : skippedMutate ? ' (compare: bỏ qua propose flag).' : ''}`
      : `Legal: AML ${amlOut.status ?? 'unknown'}; chưa có citation RAG.`;

    const { analysis, usedLlm } = await this.analyzeExpert({
      role: 'legal',
      overallGoal,
      stepGoal: step.goal,
      facts: {
        customer,
        aml: aml.output,
        regulationSearch: reg.output,
        citations: kb.citations,
        policySummary: kb.summary,
      },
      fallbackSummary,
    });

    return {
      mode: 'direct',
      toolCalls: [
        {
          id: 'tc-aml',
          tool: aml.tool,
          mcp: aml.mcp,
          capability: aml.capability,
          mutates: aml.mutates,
          latencyMs: aml.latencyMs,
          domainCorrect: true,
          output: aml.output,
        },
        {
          id: 'tc-rag-legal',
          tool: kb.tool,
          mcp: 'rag',
          capability: 'rag',
          mutates: false,
          mode: kb.mode,
          domainCorrect: true,
          output: { summary: kb.summary, citations: kb.citations },
        },
        {
          id: 'tc-reg',
          tool: reg.tool,
          mcp: reg.mcp,
          capability: reg.capability,
          mutates: reg.mutates,
          latencyMs: reg.latencyMs,
          domainCorrect: true,
          output: reg.output,
        },
        ...(pendingApproval
          ? [
              {
                id: 'pending-flag',
                tool: pendingApproval.tool,
                mcp: pendingApproval.mcp,
                capability: pendingApproval.capability,
                mutates: true,
                requiresApproval: true,
                status: 'pending_approval',
                domainCorrect: true,
                args: pendingApproval.args,
              },
            ]
          : []),
        ...(skippedMutate ? [skippedMutate] : []),
      ],
      pendingApproval,
      output: {
        summary: fallbackSummary,
        analysis,
        analysisUsedLlm: usedLlm,
        amlStatus: amlOut.status ?? null,
        risk: amlOut.risk ?? null,
        flags: amlOut.flags ?? [],
        citations: kb.citations,
        ...(pendingApproval
          ? {
              approvalReason: 'mutates',
              approvalPreview: pendingApproval.preview,
            }
          : {}),
        stepGoal: step.goal,
      },
    };
  }

  private async runProduct(
    bankCode: string,
    customer: Record<string, string>,
    step: TaskStepPlan,
    overallGoal: string,
    prior: Record<string, unknown>,
  ): Promise<SpecialistResult> {
    const credit = prior['step-credit'] as
      | { eligible?: boolean; analysis?: string }
      | undefined;
    const collateral = prior['step-collateral'] as
      | { status?: string; eligible?: boolean; analysis?: string }
      | undefined;
    const legal = prior['step-legal'] as
      | { amlStatus?: string; analysis?: string }
      | undefined;
    const compare = await this.mcp.callTool({
      bankCode,
      agentRole: 'product',
      tool: 'compare_products',
      args: {
        purpose: step.goal,
        segment: step.goal.toLowerCase().includes('dn') ? 'sme' : 'retail',
      },
    });
    const out = compare.output as {
      recommendedProduct?: string;
      products?: unknown[];
    };

    const fallbackSummary =
      credit?.eligible === false || collateral?.eligible === false
        ? 'Product: hồ sơ chưa đủ điều kiện tín dụng/TSĐB — chỉ đề xuất để tham khảo, chưa giải ngân.'
        : `Product: đề xuất ${out.recommendedProduct ?? 'sản phẩm phù hợp'} (MCP product).`;

    const { analysis, usedLlm } = await this.analyzeExpert({
      role: 'product',
      overallGoal,
      stepGoal: step.goal,
      facts: {
        customer,
        productCompare: compare.output,
        priorCredit: {
          eligible: credit?.eligible,
          analysis: credit?.analysis,
        },
        priorLegal: {
          amlStatus: legal?.amlStatus,
          analysis: legal?.analysis,
        },
        priorCollateral: {
          status: collateral?.status,
          eligible: collateral?.eligible,
          analysis: collateral?.analysis,
        },
      },
      fallbackSummary,
    });

    return {
      mode: 'direct',
      toolCalls: [
        {
          id: 'tc-prod',
          tool: compare.tool,
          mcp: compare.mcp,
          capability: compare.capability,
          mutates: compare.mutates,
          latencyMs: compare.latencyMs,
          domainCorrect: true,
          output: compare.output,
        },
      ],
      output: {
        summary: fallbackSummary,
        analysis,
        analysisUsedLlm: usedLlm,
        recommendedProduct: out.recommendedProduct ?? null,
        products: out.products ?? [],
        stepGoal: step.goal,
      },
    };
  }

  private async runCollateral(
    bankCode: string,
    customer: Record<string, string>,
    step: TaskStepPlan,
    overallGoal: string,
  ): Promise<SpecialistResult> {
    const requestedAmountVnd = customer.requestedHint
      ? Number(customer.requestedHint)
      : undefined;
    const collateral = await this.mcp.callTool({
      bankCode,
      agentRole: 'collateral',
      tool: 'get_collateral_package',
      args: { bankCode, ...customer, requestedAmountVnd },
    });
    const out = collateral.output as {
      error?: string;
      collateralType?: string | null;
      appraisedValueVnd?: number | null;
      appraisalFresh?: boolean;
      appraisalAgeMonths?: number | null;
      maxAgeMonths?: number;
      ownershipStatus?: string;
      securityRegistrationStatus?: string;
      ltvActual?: number | null;
      unsecured?: boolean;
    };

    const kb = await this.rag.kbTool('collateral_kb_search', {
      bankCode,
      query: 'LTV định giá quyền sở hữu đăng ký giao dịch bảo đảm',
      limit: 3,
    });

    const ownershipOk = ['valid', 'not_applicable'].includes(
      out.ownershipStatus ?? 'unknown',
    );
    const registrationOk = ['registered', 'not_applicable'].includes(
      out.securityRegistrationStatus ?? 'unknown',
    );
    const freshnessOk = out.appraisalFresh === true;
    const policyMaxLtv = /nhà xưởng/i.test(out.collateralType ?? '')
      ? 75
      : /ô tô/i.test(out.collateralType ?? '')
        ? 80
        : /bất động sản/i.test(out.collateralType ?? '')
          ? 70
          : null;
    const ltvWithinPolicy =
      out.unsecured === true ||
      (out.ltvActual !== null &&
        out.ltvActual !== undefined &&
        policyMaxLtv !== null &&
        out.ltvActual <= policyMaxLtv);
    const missingData: string[] = [];
    if (out.error) missingData.push('Không tìm thấy hồ sơ tài sản bảo đảm');
    if (!out.unsecured && !out.appraisedValueVnd)
      missingData.push('Thiếu giá trị định giá TSĐB');
    if (!ownershipOk) missingData.push('Quyền sở hữu TSĐB chưa hợp lệ');
    if (!registrationOk)
      missingData.push('Chưa hoàn tất đăng ký giao dịch bảo đảm');
    if (!freshnessOk && !out.unsecured)
      missingData.push('Kết quả định giá TSĐB đã quá hạn');
    if (!ltvWithinPolicy && out.ltvActual !== null)
      missingData.push(
        `LTV ${out.ltvActual}% vượt ngưỡng chính sách ${policyMaxLtv ?? 'chưa xác định'}%`,
      );

    const eligible =
      !out.error &&
      (out.unsecured === true ||
        (missingData.length === 0 &&
          out.ltvActual !== null &&
          out.ltvActual !== undefined &&
          ltvWithinPolicy));
    const status = eligible
      ? out.unsecured
        ? 'not_applicable'
        : 'acceptable'
      : 'needs_info';

    const fallbackSummary = out.unsecured
      ? 'Collateral: khoản vay tín chấp, không áp dụng TSĐB/LTV.'
      : eligible
        ? `Collateral: TSĐB đạt kiểm tra sơ bộ; LTV thực ${out.ltvActual ?? '—'}%, định giá còn hiệu lực.`
        : `Collateral: cần bổ sung — ${missingData.join('; ') || 'chưa đủ dữ liệu'}.`;

    const { analysis, usedLlm } = await this.analyzeExpert({
      role: 'collateral',
      overallGoal,
      stepGoal: step.goal,
      facts: {
        customer,
        collateralPackage: collateral.output,
        checks: {
          status,
          eligible,
          policyMaxLtv,
          ltvWithinPolicy,
          missingData,
        },
        citations: kb.citations,
        policySummary: kb.summary,
      },
      fallbackSummary,
    });

    return {
      mode: 'direct',
      toolCalls: [
        {
          id: 'tc-collateral',
          tool: collateral.tool,
          mcp: collateral.mcp,
          capability: collateral.capability,
          mutates: false,
          latencyMs: collateral.latencyMs,
          domainCorrect: true,
          output: collateral.output,
        },
        {
          id: 'tc-rag-collateral',
          tool: kb.tool,
          mcp: 'rag',
          capability: 'rag',
          mutates: false,
          mode: kb.mode,
          domainCorrect: true,
          output: { summary: kb.summary, citations: kb.citations },
        },
      ],
      output: {
        summary: fallbackSummary,
        analysis,
        analysisUsedLlm: usedLlm,
        status,
        eligible,
        collateralType: out.collateralType ?? null,
        appraisedValueVnd: out.appraisedValueVnd ?? null,
        ltvActual: out.ltvActual ?? null,
        policyMaxLtv,
        ltvWithinPolicy,
        appraisalFresh: out.appraisalFresh ?? false,
        ownershipStatus: out.ownershipStatus ?? 'unknown',
        securityRegistrationStatus:
          out.securityRegistrationStatus ?? 'unknown',
        missingData,
        citations: kb.citations,
        stepGoal: step.goal,
      },
    };
  }

  private async runOps(
    bankCode: string,
    customer: Record<string, string>,
    step: TaskStepPlan,
    skipApprovalPropose?: boolean,
  ): Promise<SpecialistResult> {
    const pendingApproval: PendingApproval | undefined = skipApprovalPropose
      ? undefined
      : {
          reason: 'mutates',
          preview: `Đề xuất tạo ticket vận hành: "${step.goal.slice(0, 80)}" — chờ duyệt trước khi gọi mcp-ops.create_service_ticket.`,
          tool: 'create_service_ticket',
          agentRole: 'ops',
          mcp: 'mcp-ops-shb',
          capability: 'ops',
          args: {
            subject: step.goal.slice(0, 120),
            department: 'ops',
            customerNo: customer.customerNo,
            priority: 'medium',
          },
        };

    const summary = pendingApproval
      ? pendingApproval.preview
      : `Ops: đề xuất ticket (compare: bỏ qua Approval) — ${step.goal.slice(0, 80)}`;

    return {
      mode: 'direct',
      toolCalls: [
        pendingApproval
          ? {
              id: 'pending-ticket',
              tool: pendingApproval.tool,
              mcp: pendingApproval.mcp,
              capability: pendingApproval.capability,
              mutates: true,
              requiresApproval: true,
              status: 'pending_approval',
              domainCorrect: true,
              args: pendingApproval.args,
            }
          : {
              id: 'compare-ticket-skipped',
              tool: 'create_service_ticket',
              mcp: 'mcp-ops-shb',
              capability: 'ops',
              mutates: true,
              requiresApproval: true,
              status: 'skipped_for_compare',
              domainCorrect: true,
            },
      ],
      pendingApproval,
      output: {
        summary,
        analysis: summary,
        ...(pendingApproval
          ? {
              approvalReason: 'mutates' as const,
              approvalPreview: pendingApproval.preview,
            }
          : {}),
        stepGoal: step.goal,
      },
    };
  }

  /** Pull customerNo / name / amount hints from free text. */
  private extractCustomerHints(
    goal: string,
    stepGoal: string,
  ): Record<string, string> {
    const text = `${goal}\n${stepGoal}`;
    const hints: Record<string, string> = {};

    const no = text.match(/SHB-KH-\d+/i);
    if (no) hints.customerNo = no[0].toUpperCase();

    if (/nguyễn văn an/i.test(text)) {
      hints.fullName = 'Nguyễn Văn An';
      hints.customerNo ??= 'SHB-KH-1001';
    } else if (/mekong/i.test(text)) {
      hints.fullName = 'SHB Mekong';
      hints.customerNo ??= 'SHB-KH-1002';
    } else if (/trần thị bình/i.test(text)) {
      hints.fullName = 'Trần Thị Bình';
      hints.customerNo ??= 'SHB-KH-1003';
    }

    const amountTy = text.match(/(\d+(?:[.,]\d+)?)\s*tỷ/i);
    if (amountTy) {
      const n = Number(amountTy[1].replace(',', '.'));
      if (!Number.isNaN(n)) hints.requestedHint = String(Math.round(n * 1e9));
    } else {
      const amountVnd = text.match(/(\d[\d.,]*)\s*VND/i);
      if (amountVnd) {
        const n = Number(amountVnd[1].replace(/[.,]/g, ''));
        if (!Number.isNaN(n)) hints.requestedHint = String(Math.round(n));
      }
    }

    return hints;
  }
}
