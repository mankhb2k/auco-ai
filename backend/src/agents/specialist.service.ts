import { Injectable } from '@nestjs/common';
import type { AgentRole } from './agent-catalog';
import { McpGatewayService } from '../mcp-client/mcp-gateway.service';
import type { TaskStepPlan } from '../planning/task-plan.schema';
import { RagService } from '../rag/rag.service';

export type PendingApproval = {
  reason: 'mutates';
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

@Injectable()
export class SpecialistService {
  constructor(
    private readonly mcp: McpGatewayService,
    private readonly rag: RagService,
  ) {}

  async run(
    step: TaskStepPlan,
    ctx: {
      goal: string;
      bankCode?: string;
      priorOutputs: Record<string, unknown>;
    },
  ): Promise<SpecialistResult> {
    const role = step.agentRole as AgentRole;
    const mode =
      step.mode ?? (role === 'credit' ? 'spawn_workers' : 'direct');
    const bankCode = ctx.bankCode ?? 'SHB';
    const customer = this.extractCustomerHints(ctx.goal, step.goal);

    if (mode === 'spawn_workers' && role === 'credit') {
      return this.runCreditWorkers(bankCode, customer, step);
    }

    if (role === 'legal') {
      return this.runLegal(bankCode, customer, step);
    }
    if (role === 'product') {
      return this.runProduct(bankCode, customer, step, ctx.priorOutputs);
    }
    if (role === 'ops') {
      return this.runOps(bankCode, customer, step);
    }

    // credit direct fallback
    return this.runCreditWorkers(bankCode, customer, step);
  }

  private async runCreditWorkers(
    bankCode: string,
    customer: Record<string, string>,
    step: TaskStepPlan,
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
      query: step.goal.includes('LTV') || step.goal.includes('nhà máy')
        ? 'LTV nhà xưởng DTI CIC'
        : 'DTI CIC hạn mức vay mua nhà',
      limit: 3,
      includeSuperseded: true,
    });

    const scoreOut = results[0]?.output as { score?: number } | undefined;
    const eligOut = results[2]?.output as {
      eligible?: boolean;
      maxAmountVnd?: number;
      recommendation?: string;
    } | undefined;

    const amountVnd =
      Number(customer.requestedHint) ||
      eligOut?.maxAmountVnd ||
      1_600_000_000;

    const pendingApproval: PendingApproval = {
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
          output: r.output,
        })),
        {
          id: 'w-rag',
          tool: kb.tool,
          mcp: 'rag',
          capability: 'rag',
          mutates: false,
          mode: kb.mode,
          output: { summary: kb.summary, citations: kb.citations },
        },
        {
          id: 'pending-submit',
          tool: pendingApproval.tool,
          mcp: pendingApproval.mcp,
          capability: pendingApproval.capability,
          mutates: true,
          requiresApproval: true,
          status: 'pending_approval',
          args: pendingApproval.args,
        },
      ],
      pendingApproval,
      output: {
        summary: `${eligOut?.eligible ? 'Credit: đủ điều kiện sơ bộ' : 'Credit: cần review'} — điểm ${scoreOut?.score ?? '—'}; ${pendingApproval.preview}`,
        eligible: eligOut?.eligible ?? false,
        score: scoreOut?.score ?? null,
        maxAmountVnd: eligOut?.maxAmountVnd ?? null,
        recommendation: eligOut?.recommendation ?? 'refer_manual_review',
        workers: results.map((r) => r.id),
        citations: kb.citations,
        approvalReason: 'mutates',
        approvalPreview: pendingApproval.preview,
        stepGoal: step.goal,
      },
    };
  }

  private async runLegal(
    bankCode: string,
    customer: Record<string, string>,
    step: TaskStepPlan,
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

    // Keep MCP keyword search as secondary audit trail
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

    const pendingApproval: PendingApproval | undefined = needsFlag
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
          output: aml.output,
        },
        {
          id: 'tc-rag-legal',
          tool: kb.tool,
          mcp: 'rag',
          capability: 'rag',
          mutates: false,
          mode: kb.mode,
          output: { summary: kb.summary, citations: kb.citations },
        },
        {
          id: 'tc-reg',
          tool: reg.tool,
          mcp: reg.mcp,
          capability: reg.capability,
          mutates: reg.mutates,
          latencyMs: reg.latencyMs,
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
                args: pendingApproval.args,
              },
            ]
          : []),
      ],
      pendingApproval,
      output: {
        summary: topCite
          ? `Legal: AML ${amlOut.status ?? 'unknown'} (risk ${amlOut.risk ?? '—'}); citation: ${topCite.sourceDoc} [${topCite.status}] score=${topCite.score.toFixed(3)}.${pendingApproval ? ` ${pendingApproval.preview}` : ''}`
          : `Legal: AML ${amlOut.status ?? 'unknown'}; chưa có citation RAG.`,
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
    prior: Record<string, unknown>,
  ): Promise<SpecialistResult> {
    const credit = prior['step-credit'] as { eligible?: boolean } | undefined;
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
          output: compare.output,
        },
      ],
      output: {
        summary:
          credit?.eligible === false
            ? 'Product: hồ sơ chưa đủ điều kiện — chưa đề xuất giải ngân.'
            : `Product: đề xuất ${out.recommendedProduct ?? 'sản phẩm phù hợp'} (MCP product).`,
        recommendedProduct: out.recommendedProduct ?? null,
        products: out.products ?? [],
        stepGoal: step.goal,
      },
    };
  }

  private async runOps(
    bankCode: string,
    customer: Record<string, string>,
    step: TaskStepPlan,
  ): Promise<SpecialistResult> {
    const pendingApproval: PendingApproval = {
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

    return {
      mode: 'direct',
      toolCalls: [
        {
          id: 'pending-ticket',
          tool: pendingApproval.tool,
          mcp: pendingApproval.mcp,
          capability: pendingApproval.capability,
          mutates: true,
          requiresApproval: true,
          status: 'pending_approval',
          args: pendingApproval.args,
        },
      ],
      pendingApproval,
      output: {
        summary: pendingApproval.preview,
        approvalReason: 'mutates',
        approvalPreview: pendingApproval.preview,
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
    }

    return hints;
  }
}
