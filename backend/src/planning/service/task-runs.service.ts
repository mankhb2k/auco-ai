import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/service/audit.service';
import { PrismaService } from '../../prisma/service/prisma.service';
import { OrchestratorService } from './orchestrator.service';
import { PlannerService } from './planner.service';
import type { TaskPlan } from '../task-plan.schema';

export type CreateTaskRunDto = {
  goal: string;
  bankCode?: string;
  employeeId?: string;
  /** If true, return after planning without waiting for orchestrator (still runs async). Default false = await full run. */
  async?: boolean;
  /** Phase 9: multi (default) vs single-agent baseline */
  mode?: 'multi' | 'single';
  /** Phase 9 compare: finish DAG without parking on Approval */
  skipApprovalPropose?: boolean;
};

type PlanWithMeta = TaskPlan & {
  orchestrationMode?: 'multi' | 'single';
  skipApprovalPropose?: boolean;
  baseline?: boolean;
};

@Injectable()
export class TaskRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: PlannerService,
    private readonly orchestrator: OrchestratorService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateTaskRunDto) {
    const goal = dto.goal?.trim();
    if (!goal) {
      throw new Error('goal is required');
    }

    const bankCode = dto.bankCode?.trim() || 'SHB';
    const employeeId = dto.employeeId?.trim() || undefined;
    const mode = dto.mode ?? 'multi';

    let planned: {
      plan: PlanWithMeta;
      source: string;
      scenario: string;
    };

    if (mode === 'single') {
      planned = {
        plan: {
          summary: 'Baseline single-agent — không Planner',
          steps: [
            {
              id: 'step-baseline',
              agentRole: 'credit',
              goal,
              dependsOn: [],
              mode: 'direct',
              requiredCapabilities: [],
            },
          ],
          orchestrationMode: 'single',
          baseline: true,
          skipApprovalPropose: true,
        },
        source: 'baseline_single',
        scenario: 'baseline',
      };
    } else {
      const fromPlanner = await this.planner.createPlan(goal);
      planned = {
        plan: {
          ...fromPlanner.plan,
          orchestrationMode: 'multi',
          skipApprovalPropose: dto.skipApprovalPropose === true,
        },
        source: fromPlanner.source,
        scenario: fromPlanner.scenario,
      };
    }

    const taskRun = await this.prisma.taskRun.create({
      data: {
        bankCode,
        employeeId,
        goal,
        status: 'planning',
        planJson: planned.plan as unknown as Prisma.InputJsonValue,
        steps: {
          create: planned.plan.steps.map((s) => ({
            agentRole: s.agentRole,
            mode:
              s.mode ??
              (s.agentRole === 'credit' ? 'spawn_workers' : 'direct'),
            input: {
              planStepId: s.id,
              goal: s.goal,
              requiredCapabilities: s.requiredCapabilities ?? [],
              orchestrationMode: planned.plan.orchestrationMode ?? mode,
              baseline: planned.plan.baseline === true,
            } as Prisma.InputJsonValue,
            status: 'pending',
            dependsOn: s.dependsOn,
            toolCalls: [],
          })),
        },
      },
      include: { steps: true },
    });

    if (employeeId) {
      this.audit.recordSafe({
        actorId: employeeId,
        bankCode,
        action: 'task_run.create',
        resource: `TaskRun:${taskRun.id}`,
        detail: {
          mode,
          scenario: planned.scenario,
          planSource: planned.source,
          async: dto.async === true,
        },
      });
    }

    if (dto.async) {
      void this.orchestrator.runTaskRun(taskRun.id);
      return {
        ...taskRun,
        meta: {
          planSource: planned.source,
          scenario: planned.scenario,
          orchestrationMode: mode,
          running: true,
        },
      };
    }

    await this.orchestrator.runTaskRun(taskRun.id);
    return this.getById(taskRun.id);
  }

  async getById(id: string) {
    const task = await this.prisma.taskRun.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { id: 'asc' } },
        employee: true,
      },
    });
    if (!task) {
      throw new NotFoundException(`TaskRun ${id} not found`);
    }
    return task;
  }

}
