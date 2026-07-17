import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SpecialistStubService } from '../agents/specialist-stub.service';
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
    private readonly specialists: SpecialistStubService,
  ) {}

  async runTaskRun(taskRunId: string): Promise<void> {
    const task = await this.prisma.taskRun.findUniqueOrThrow({
      where: { id: taskRunId },
      include: { steps: true },
    });

    const plan = task.planJson as unknown as TaskPlan;
    const stepById = new Map(task.steps.map((s) => [s.id, s]));

    await this.prisma.taskRun.update({
      where: { id: taskRunId },
      data: { status: 'running' },
    });

    const doneIds = new Set<string>();
    const failedIds = new Set<string>();
    const startedOrDone = new Set<string>();
    const priorOutputs: Record<string, unknown> = {};

    // Mark already-done steps (resume support)
    for (const s of task.steps) {
      if (s.status === 'done') {
        doneIds.add(s.id);
        startedOrDone.add(s.id);
        if (s.output) priorOutputs[s.id] = s.output;
      }
      if (s.status === 'failed') {
        failedIds.add(s.id);
        startedOrDone.add(s.id);
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
          batch.map((stepPlan) =>
            this.dispatchStep({
              taskRunId,
              goal: task.goal,
              stepPlan,
              dbStepId: stepById.get(stepPlan.id)?.id ?? stepPlan.id,
              priorOutputs,
              doneIds,
              failedIds,
            }),
          ),
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

      await this.prisma.taskRun.update({
        where: { id: taskRunId },
        data: { status: 'done', finalAnswer },
      });
      this.logger.log(`TaskRun ${taskRunId} done`);
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
    stepPlan: TaskStepPlan;
    dbStepId: string;
    priorOutputs: Record<string, unknown>;
    doneIds: Set<string>;
    failedIds: Set<string>;
  }) {
    const { stepPlan, dbStepId, priorOutputs, doneIds, failedIds } = opts;
    const startedAt = new Date();

    await this.prisma.taskStep.update({
      where: { id: dbStepId },
      data: { status: 'running', startedAt },
    });

    try {
      const result = await this.specialists.run(stepPlan, {
        goal: opts.goal,
        priorOutputs,
      });

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
    }
  }
}
