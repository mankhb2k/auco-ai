import { TaskRunsService } from './task-runs.service';
import type { AuditService } from '../../audit/service/audit.service';
import type { OrchestratorService } from './orchestrator.service';
import type { PlannerService } from './planner.service';
import type { PrismaService } from '../../prisma/service/prisma.service';

describe('TaskRunsService', () => {
  const prisma = {
    taskRun: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;
  const planner = { createPlan: jest.fn() } as unknown as PlannerService;
  const orchestrator = {
    runTaskRun: jest.fn(),
  } as unknown as OrchestratorService;
  const audit = { recordSafe: jest.fn() } as unknown as AuditService;

  let service: TaskRunsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaskRunsService(prisma, planner, orchestrator, audit);
  });

  it('rejects empty goal', async () => {
    await expect(service.create({ goal: '   ' })).rejects.toThrow(
      /goal is required/,
    );
  });

  it('creates single-agent baseline without planner', async () => {
    (prisma.taskRun.create as jest.Mock).mockResolvedValue({
      id: 't1',
      goal: 'baseline',
      status: 'planning',
      steps: [],
    });
    (prisma.taskRun.findUnique as jest.Mock).mockResolvedValue({
      id: 't1',
      goal: 'baseline',
      status: 'done',
      steps: [],
    });
    (orchestrator.runTaskRun as jest.Mock).mockResolvedValue(undefined);

    await service.create({
      goal: 'baseline question',
      mode: 'single',
      async: false,
    });

    expect(planner.createPlan).not.toHaveBeenCalled();
    expect(prisma.taskRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bankCode: 'SHB',
          goal: 'baseline question',
          planJson: expect.objectContaining({
            baseline: true,
            orchestrationMode: 'single',
          }),
        }),
      }),
    );
    expect(orchestrator.runTaskRun).toHaveBeenCalledWith('t1');
  });

  it('creates multi task via planner', async () => {
    (planner.createPlan as jest.Mock).mockResolvedValue({
      plan: {
        summary: 'demo',
        steps: [
          {
            id: 'step-credit',
            agentRole: 'credit',
            goal: 'credit',
            dependsOn: [],
            mode: 'spawn_workers',
          },
        ],
      },
      source: 'demo_pinned',
      scenario: 'home',
    });
    (prisma.taskRun.create as jest.Mock).mockResolvedValue({
      id: 't2',
      steps: [],
    });
    (prisma.taskRun.findUnique as jest.Mock).mockResolvedValue({
      id: 't2',
      status: 'done',
      steps: [],
    });
    (orchestrator.runTaskRun as jest.Mock).mockResolvedValue(undefined);

    await service.create({ goal: 'multi goal', mode: 'multi' });
    expect(planner.createPlan).toHaveBeenCalledWith('multi goal');
    expect(orchestrator.runTaskRun).toHaveBeenCalledWith('t2');
  });
});
