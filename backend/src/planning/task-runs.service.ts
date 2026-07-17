import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestratorService } from './orchestrator.service';
import { PlannerService } from './planner.service';

export type CreateTaskRunDto = {
  goal: string;
  bankCode?: string;
  employeeId?: string;
  /** If true, return after planning without waiting for orchestrator (still runs async). Default false = await full run. */
  async?: boolean;
};

@Injectable()
export class TaskRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: PlannerService,
    private readonly orchestrator: OrchestratorService,
  ) {}

  async create(dto: CreateTaskRunDto) {
    const goal = dto.goal?.trim();
    if (!goal) {
      throw new Error('goal is required');
    }

    const bankCode = dto.bankCode?.trim() || 'SHB';
    const employeeId = dto.employeeId?.trim() || undefined;

    const planned = await this.planner.createPlan(goal);

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
            mode: s.mode ?? (s.agentRole === 'credit' ? 'spawn_workers' : 'direct'),
            input: {
              planStepId: s.id,
              goal: s.goal,
              requiredCapabilities: s.requiredCapabilities ?? [],
            } as Prisma.InputJsonValue,
            status: 'pending',
            dependsOn: s.dependsOn,
            toolCalls: [],
          })),
        },
      },
      include: { steps: true },
    });

    if (dto.async) {
      void this.orchestrator.runTaskRun(taskRun.id);
      return {
        ...taskRun,
        meta: {
          planSource: planned.source,
          scenario: planned.scenario,
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

  async list(limit = 20) {
    return this.prisma.taskRun.findMany({
      take: Math.min(limit, 50),
      orderBy: { createdAt: 'desc' },
      include: {
        steps: { select: { id: true, agentRole: true, status: true } },
      },
    });
  }
}
