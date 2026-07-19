import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SpecialistService } from '../../agents/service/specialist.service';
import { PrismaService } from '../../prisma/service/prisma.service';
import { readySteps } from '../plan-validator';
import { PlannerService } from './planner.service';
import { computePolicyGate } from './policy-gate';
import type { TaskPlan, TaskStepPlan } from '../task-plan.schema';

const CONCURRENCY = 3;

@Injectable()
export class OrchestratorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: PlannerService,
    private readonly specialists: SpecialistService,
  ) {}

  /**
   * Orchestration chạy in-memory: nếu process restart giữa chừng, run bị bỏ
   * rơi sẽ kẹt ở "running" vĩnh viễn. Đánh dấu failed lúc boot để UI cho retry.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const orphaned = await this.prisma.taskRun.findMany({
        where: { status: { in: ['planning', 'running'] } },
        select: { id: true },
      });
      if (orphaned.length === 0) return;

      const ids = orphaned.map((r) => r.id);
      await this.prisma.taskStep.updateMany({
        where: {
          taskRunId: { in: ids },
          status: { in: ['pending', 'running'] },
        },
        data: { status: 'failed', finishedAt: new Date() },
      });
      await this.prisma.taskRun.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'failed',
          finalAnswer:
            'Phiên đánh giá bị gián đoạn do backend khởi động lại. Vui lòng chạy lại đánh giá.',
        },
      });
      this.logger.warn(
        `Recovered ${ids.length} orphaned task run(s) after restart: ${ids.join(', ')}`,
      );
    } catch (err) {
      this.logger.error(
        `Orphaned run recovery failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Fresh run (One Job: no generic waiting_approval parking). */
  async runTaskRun(taskRunId: string): Promise<void> {
    const task = await this.prisma.taskRun.findUniqueOrThrow({
      where: { id: taskRunId },
      include: { steps: true },
    });

    const plan = task.planJson as unknown as TaskPlan & {
      skipApprovalPropose?: boolean;
      baseline?: boolean;
      orchestrationMode?: 'multi' | 'single';
    };
    // Assessment-only product: never park for generic HITL.
    const skipApprovalPropose = true;
    const baseline = plan.baseline === true;
    const stepByPlanId = new Map(
      task.steps.map((s) => {
        const input = s.input as { planStepId?: string } | null;
        const planStepId = input?.planStepId ?? s.id;
        return [planStepId, s] as const;
      }),
    );

    await this.prisma.taskRun.update({
      where: { id: taskRunId },
      data: { status: 'running' },
    });

    const doneIds = new Set<string>();
    const failedIds = new Set<string>();
    const startedOrDone = new Set<string>();
    const priorOutputs: Record<string, unknown> = {};

    for (const [planStepId, s] of stepByPlanId) {
      if (s.status === 'done') {
        doneIds.add(planStepId);
        startedOrDone.add(planStepId);
        if (s.output) priorOutputs[planStepId] = s.output;
      } else if (s.status === 'failed' || s.status === 'waiting_approval') {
        // Legacy parked steps are treated as failed in One Job.
        failedIds.add(planStepId);
        startedOrDone.add(planStepId);
      }
    }

    try {
      while (
        doneIds.size + failedIds.size < plan.steps.length &&
        failedIds.size === 0
      ) {
        const ready = readySteps(plan.steps, doneIds, startedOrDone);
        if (ready.length === 0) {
          throw new Error('Orchestrator deadlock: no ready steps');
        }

        const batch = ready.slice(0, CONCURRENCY);
        for (const s of batch) startedOrDone.add(s.id);

        await Promise.all(
          batch.map(async (stepPlan) => {
            const dbStep = stepByPlanId.get(stepPlan.id);
            if (!dbStep) {
              throw new Error(`Missing DB step for plan id ${stepPlan.id}`);
            }
            await this.dispatchStep({
              taskRunId,
              goal: task.goal,
              bankCode: task.bankCode,
              employeeId: task.employeeId ?? undefined,
              portfolioGrants: this.readPortfolioGrants(plan),
              stepPlan,
              dbStepId: dbStep.id,
              priorOutputs,
              doneIds,
              failedIds,
              skipApprovalPropose,
              baseline,
            });
          }),
        );
      }

      if (failedIds.size > 0) {
        await this.prisma.taskRun.update({
          where: { id: taskRunId },
          data: { status: 'failed' },
        });
        return;
      }

      const stepOutputs = plan.steps.map((s) => ({
        id: s.id,
        agentRole: s.agentRole,
        output: priorOutputs[s.id],
      }));

      const { finalAnswer } = await this.planner.synthesize({
        goal: task.goal,
        plan,
        stepOutputs,
      });

      // Deterministic policy gate — chạy độc lập với LLM synthesize ở trên.
      // LTV vượt ngưỡng / AML không sạch sẽ luôn ép manual_review/reject dù
      // finalAnswer viết gì (xem policy-gate.ts).
      const gate = computePolicyGate(stepOutputs);

      await this.prisma.taskRun.update({
        where: { id: taskRunId },
        data: {
          status: 'done',
          finalAnswer,
          suggestedAssessmentTag: gate.suggestedAssessmentTag,
          policyGateReasons: gate.reasons,
        },
      });
      this.logger.log(
        `TaskRun ${taskRunId} done — policyGate=${gate.suggestedAssessmentTag}${gate.reasons.length ? ` (${gate.reasons.length} hard rule(s))` : ''}`,
      );
    } catch (err) {
      this.logger.error(
        `TaskRun ${taskRunId} failed: ${err instanceof Error ? err.message : err}`,
      );
      await this.prisma.taskRun.update({
        where: { id: taskRunId },
        data: {
          status: 'failed',
          finalAnswer:
            err instanceof Error ? err.message : 'Orchestrator failed',
        },
      });
    }
  }

  private async dispatchStep(opts: {
    taskRunId: string;
    goal: string;
    bankCode: string;
    employeeId?: string;
    portfolioGrants?: string[];
    stepPlan: TaskStepPlan;
    dbStepId: string;
    priorOutputs: Record<string, unknown>;
    doneIds: Set<string>;
    failedIds: Set<string>;
    skipApprovalPropose?: boolean;
    baseline?: boolean;
  }): Promise<'done' | 'failed'> {
    const { stepPlan, dbStepId, priorOutputs, doneIds, failedIds } = opts;
    const startedAt = new Date();

    await this.prisma.taskStep.update({
      where: { id: dbStepId },
      data: { status: 'running', startedAt },
    });

    try {
      const result = await this.specialists.run(stepPlan, {
        goal: opts.goal,
        bankCode: opts.bankCode,
        priorOutputs,
        skipApprovalPropose: opts.skipApprovalPropose,
        baseline: opts.baseline,
        employeeId: opts.employeeId,
        portfolioGrants: opts.portfolioGrants,
      });

      if (result.pendingApproval) {
        await this.prisma.taskStep.update({
          where: { id: dbStepId },
          data: {
            status: 'failed',
            mode: result.mode,
            output: {
              ...result.output,
              error:
                'Generic HITL disabled in One Job. Use LoanRequest approval after assessment.',
              pendingApproval: result.pendingApproval,
            } as Prisma.InputJsonValue,
            toolCalls: result.toolCalls as Prisma.InputJsonValue[],
            finishedAt: new Date(),
          },
        });
        failedIds.add(stepPlan.id);
        this.logger.warn(
          `Step ${stepPlan.id} failed — pendingApproval not supported`,
        );
        return 'failed';
      }

      await this.prisma.taskStep.update({
        where: { id: dbStepId },
        data: {
          status: 'done',
          mode: result.mode,
          output: result.output as Prisma.InputJsonValue,
          toolCalls: result.toolCalls as Prisma.InputJsonValue[],
          finishedAt: new Date(),
        },
      });

      priorOutputs[stepPlan.id] = result.output;
      doneIds.add(stepPlan.id);
      this.logger.log(
        `Step ${stepPlan.id} (${stepPlan.agentRole}) done mode=${result.mode}`,
      );
      return 'done';
    } catch (err) {
      await this.prisma.taskStep.update({
        where: { id: dbStepId },
        data: {
          status: 'failed',
          output: {
            error: err instanceof Error ? err.message : String(err),
          } as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      failedIds.add(stepPlan.id);
      return 'failed';
    }
  }

  private readPortfolioGrants(plan: TaskPlan & { portfolioGrants?: unknown }): string[] {
    const raw = plan.portfolioGrants;
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === 'string');
  }
}
