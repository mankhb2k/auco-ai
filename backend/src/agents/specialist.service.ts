import { Injectable } from '@nestjs/common';
import type { AgentRole } from './agent-catalog';
import { McpGatewayService } from '../mcp-client/mcp-gateway.service';
import type { TaskStepPlan } from '../planning/task-plan.schema';

export type SpecialistResult = {
  output: Record<string, unknown>;
  toolCalls: Array<Record<string, unknown>>;
  mode: 'direct' | 'spawn_workers';
};

@Injectable()
export class SpecialistService {
  constructor(private readonly mcp: McpGatewayService) {}

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

    const scoreOut = results[0]?.output as { score?: number } | undefined;
    const eligOut = results[2]?.output as {
      eligible?: boolean;
      maxAmountVnd?: number;
      recommendation?: string;
    } | undefined;

    return {
      mode: 'spawn_workers',
      toolCalls: results.map((r) => ({
        id: r.id,
        tool: r.tool,
        mcp: r.mcp,
        capability: r.capability,
        mutates: r.mutates,
        bankCode: r.bankCode,
        latencyMs: r.latencyMs,
        output: r.output,
      })),
      output: {
        summary: eligOut?.eligible
          ? `Credit: đủ điều kiện sơ bộ, điểm ${scoreOut?.score ?? '—'}, hạn mức ~${eligOut.maxAmountVnd?.toLocaleString('vi-VN') ?? '—'} VND (spawn ≤3 worker qua MCP).`
          : `Credit: cần review — điểm ${scoreOut?.score ?? '—'} (MCP workers).`,
        eligible: eligOut?.eligible ?? false,
        score: scoreOut?.score ?? null,
        maxAmountVnd: eligOut?.maxAmountVnd ?? null,
        recommendation: eligOut?.recommendation ?? 'refer_manual_review',
        workers: results.map((r) => r.id),
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
    const reg = await this.mcp.callTool({
      bankCode,
      agentRole: 'legal',
      tool: 'search_regulation',
      args: {
        bankCode,
        query: step.goal.includes('39') ? 'Thông tư 39 LTV' : 'AML KYC',
        limit: 3,
      },
    });

    const amlOut = aml.output as {
      status?: string;
      risk?: string;
      flags?: string[];
    };

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
          id: 'tc-reg',
          tool: reg.tool,
          mcp: reg.mcp,
          capability: reg.capability,
          mutates: reg.mutates,
          latencyMs: reg.latencyMs,
          output: reg.output,
        },
      ],
      output: {
        summary: `Legal: AML ${amlOut.status ?? 'unknown'} (risk ${amlOut.risk ?? '—'}); đã tra cứu quy định (MCP compliance).`,
        amlStatus: amlOut.status ?? null,
        risk: amlOut.risk ?? null,
        flags: amlOut.flags ?? [],
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
    const create = await this.mcp.callTool({
      bankCode,
      agentRole: 'ops',
      tool: 'create_service_ticket',
      args: {
        subject: step.goal.slice(0, 120),
        department: 'ops',
        customerNo: customer.customerNo,
        priority: 'medium',
      },
    });
    const out = create.output as { ticketId?: string; status?: string };

    return {
      mode: 'direct',
      toolCalls: [
        {
          id: 'tc-ops',
          tool: create.tool,
          mcp: create.mcp,
          capability: create.capability,
          mutates: create.mutates,
          requiresApproval: create.requiresApproval,
          latencyMs: create.latencyMs,
          output: create.output,
        },
      ],
      output: {
        summary: `Ops: tạo ticket ${out.ticketId ?? '—'} (${out.status ?? 'open'}) qua MCP ops.`,
        ticketId: out.ticketId ?? null,
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
