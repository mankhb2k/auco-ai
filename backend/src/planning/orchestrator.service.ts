import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SpecialistService } from '../agents/specialist.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { readySteps } from './plan-validator';
import { PlannerService } from './planner.service';
import type { TaskPlan, TaskStepPlan } from './task-plan.schema';

const CONCURRENCY = 3;

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: PlannerService,
    private readonly specialists: SpecialistService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Fresh run or resume after approval. */
  async runTaskRun(taskRunId: string): Promise<void> {
    const task = await this.prisma.taskRun.findUniqueOrThrow({
      where: { id: taskRunId },
      include: { steps: true },
    });

    const plan = task.planJson as unknown as TaskPlan;
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
    this.realtime.emitTaskUpdated(taskRunId, { status: 'running' });

    const doneIds = new Set<string>();
    const failedIds = new Set<string>();
    const startedOrDone = new Set<string>();
    const priorOutputs: Record<string, unknown> = {};
    let parkedWaiting = false;

    for (const [planStepId, s] of stepByPlanId) {
      if (s.status === 'done') {
        doneIds.add(planStepId);
        startedOrDone.add(planStepId);
        if (s.output) priorOutputs[planStepId] = s.output;
      } else if (s.status === 'failed') {
        failedIds.add(planStepId);
        startedOrDone.add(planStepId);
      } else if (s.status === 'waiting_approval') {
        startedOrDone.add(planStepId);
        parkedWaiting = true;
      }
    }

    if (parkedWaiting) {
      this.logger.log(`TaskRun ${taskRunId} still waiting_approval — not resuming yet`);
      return;
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

        let hitApproval = false;
        await Promise.all(
          batch.map(async (stepPlan) => {
            const dbStep = stepByPlanId.get(stepPlan.id);
            if (!dbStep) {
              throw new Error(`Missing DB step for plan id ${stepPlan.id}`);
            }
            const outcome = await this.dispatchStep({
              taskRunId,
              goal: task.goal,
              bankCode: task.bankCode,
              stepPlan,
              dbStepId: dbStep.id,
              priorOutputs,
              doneIds,
              failedIds,
            });
            if (outcome === 'waiting_approval') hitApproval = true;
          }),
        );

        if (hitApproval) {
          this.logger.log(`TaskRun ${taskRunId} parked — waiting_approval`);
          this.realtime.emitTaskUpdated(taskRunId, {
            status: 'running',
            waitingApproval: true,
          });
          return;
        }
      }

      if (failedIds.size > 0) {
        await this.prisma.taskRun.update({
          where: { id: taskRunId },
          data: { status: 'failed' },
        });
        this.realtime.emitTaskUpdated(taskRunId, { status: 'failed' });
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

      await this.prisma.taskRun.update({
        where: { id: taskRunId },
        data: { status: 'done', finalAnswer },
      });
      this.logger.log(`TaskRun ${taskRunId} done`);
      this.realtime.emitTaskUpdated(taskRunId, {
        status: 'done',
        finalAnswer,
      });
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
      this.realtime.emitTaskUpdated(taskRunId, { status: 'failed' });
    }
  }

  /** After approve: mark waiting steps that were approved as done already, then continue. */
  async resumeTaskRun(taskRunId: string): Promise<void> {
    return this.runTaskRun(taskRunId);
  }

  private async dispatchStep(opts: {
    taskRunId: string;
    goal: string;
    bankCode: string;
    stepPlan: TaskStepPlan;
    dbStepId: string;
    priorOutputs: Record<string, unknown>;
    doneIds: Set<string>;
    failedIds: Set<string>;
  }): Promise<'done' | 'failed' | 'waiting_approval'> {
    const { stepPlan, dbStepId, priorOutputs, doneIds, failedIds } = opts;
    const startedAt = new Date();

    await this.prisma.taskStep.update({
      where: { id: dbStepId },
      data: { status: 'running', startedAt },
    });
    this.realtime.emitStepUpdated(opts.taskRunId, {
      stepId: dbStepId,
      planStepId: stepPlan.id,
      status: 'running',
    });

    try {
      const result = await this.specialists.run(stepPlan, {
        goal: opts.goal,
        bankCode: opts.bankCode,
        priorOutputs,
      });

      if (result.pendingApproval) {
        const output = {
          ...result.output,
          pendingApproval: result.pendingApproval,
        };
        await this.prisma.taskStep.update({
          where: { id: dbStepId },
          data: {
            status: 'waiting_approval',
            mode: result.mode,
            output: output as Prisma.InputJsonValue,
            toolCalls: result.toolCalls as Prisma.InputJsonValue[],
            finishedAt: null,
          },
        });
        this.logger.log(
          `Step ${stepPlan.id} waiting_approval tool=${result.pendingApproval.tool}`,
        );
        this.realtime.emitApprovalNeeded(opts.taskRunId, {
          stepId: dbStepId,
          planStepId: stepPlan.id,
          preview: result.pendingApproval.preview,
          tool: result.pendingApproval.tool,
        });
        this.realtime.emitStepUpdated(opts.taskRunId, {
          stepId: dbStepId,
          planStepId: stepPlan.id,
          status: 'waiting_approval',
        });
        return 'waiting_approval';
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
      this.realtime.emitStepUpdated(opts.taskRunId, {
        stepId: dbStepId,
        planStepId: stepPlan.id,
        status: 'done',
      });
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
      this.realtime.emitStepUpdated(opts.taskRunId, {
        stepId: dbStepId,
        planStepId: stepPlan.id,
        status: 'failed',
      });
      return 'failed';
    }
  }
}
