import { Injectable } from '@nestjs/common';
import type { AgentRole } from '../../agents/agent-catalog';
import type { TaskStepPlan } from '../../planning/task-plan.schema';

/** Phase 4 stub — real MCP/RAG in later phases */
@Injectable()
export class SpecialistStubService {
  async run(
    step: TaskStepPlan,
    ctx: { goal: string; priorOutputs: Record<string, unknown> },
  ): Promise<{
    output: Record<string, unknown>;
    toolCalls: Array<Record<string, unknown>>;
    mode: 'direct' | 'spawn_workers';
  }> {
    const role = step.agentRole as AgentRole;
    const mode =
      step.mode ?? (role === 'credit' ? 'spawn_workers' : 'direct');

    if (mode === 'spawn_workers' && role === 'credit') {
      const workers = [
        {
          id: 'w1',
          tool: 'get_credit_score',
          mcp: 'mcp-core-banking',
          output: { score: 720, cicGroup: 1 },
        },
        {
          id: 'w2',
          tool: 'get_transaction_history',
          mcp: 'mcp-core-banking',
          output: { months: 6, inflowStable: true },
        },
        {
          id: 'w3',
          tool: 'check_loan_eligibility',
          mcp: 'mcp-los',
          output: { eligible: true, maxAmountVnd: 1_600_000_000 },
        },
      ];
      return {
        mode,
        toolCalls: workers.map((w) => ({
          id: w.id,
          tool: w.tool,
          mcp: w.mcp,
          mutates: false,
          output: w.output,
          stub: true,
        })),
        output: {
          summary:
            'Credit stub: đủ điều kiện sơ bộ, điểm 720, hạn mức đề xuất ~1.6 tỷ (spawn ≤3 worker).',
          eligible: true,
          score: 720,
          recommendation: 'approve_with_conditions',
          workers: workers.map((w) => w.id),
          stepGoal: step.goal,
        },
      };
    }

    if (role === 'legal') {
      return {
        mode: 'direct',
        toolCalls: [
          {
            id: 'tc-aml',
            tool: 'run_aml_check',
            mcp: 'mcp-compliance',
            mutates: false,
            output: { status: 'clear', risk: 'low' },
            stub: true,
          },
        ],
        output: {
          summary:
            'Legal stub: AML clear; cần citation quy định (RAG Phase 7).',
          amlStatus: 'clear',
          risks: [],
          stepGoal: step.goal,
        },
      };
    }

    if (role === 'collateral') {
      return {
        mode: 'direct',
        toolCalls: [
          {
            id: 'tc-collateral',
            tool: 'get_collateral_package',
            mcp: 'mcp-los',
            mutates: false,
            output: {
              appraisedValueVnd: 3_200_000_000,
              ltvActual: 62.5,
              appraisalFresh: true,
              ownershipStatus: 'valid',
              securityRegistrationStatus: 'registered',
            },
            stub: true,
          },
        ],
        output: {
          summary: 'Collateral stub: TSĐB hợp lệ, LTV 62,5%.',
          status: 'acceptable',
          eligible: true,
          ltvActual: 62.5,
          missingData: [],
          stepGoal: step.goal,
        },
      };
    }

    if (role === 'product') {
      const credit = ctx.priorOutputs['step-credit'] as
        | { eligible?: boolean }
        | undefined;
      const collateral = ctx.priorOutputs['step-collateral'] as
        | { eligible?: boolean }
        | undefined;
      return {
        mode: 'direct',
        toolCalls: [
          {
            id: 'tc-prod',
            tool: 'compare_products',
            mcp: 'mcp-product',
            mutates: false,
            output: {
              products: ['SHB Home Loan Standard', 'SHB Preferential Mortgage'],
            },
            stub: true,
          },
        ],
        output: {
          summary:
            credit?.eligible === false || collateral?.eligible === false
              ? 'Product stub: hồ sơ chưa đủ điều kiện — chưa đề xuất giải ngân.'
              : 'Product stub: đề xuất SHB Home Loan Standard / Preferential Mortgage.',
          recommendedProduct: 'SHB Home Loan Standard',
          stepGoal: step.goal,
        },
      };
    }

    // ops
    return {
      mode: 'direct',
      toolCalls: [
        {
          id: 'tc-ops',
          tool: 'create_service_ticket',
          mcp: 'mcp-ops',
          mutates: true,
          output: { ticketId: 'TK-STUB-001', status: 'draft' },
          stub: true,
        },
      ],
      output: {
        summary: 'Ops stub: tạo ticket nháp (side-effect sẽ qua Approval ở Phase 8).',
        ticketId: 'TK-STUB-001',
        stepGoal: step.goal,
      },
    };
  }
}
