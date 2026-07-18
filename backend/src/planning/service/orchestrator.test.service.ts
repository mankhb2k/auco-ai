import { OrchestratorService } from './orchestrator.service';
import type { SpecialistService } from '../../agents/service/specialist.service';
import type { PrismaService } from '../../prisma/service/prisma.service';
import type { RealtimeService } from '../../realtime/service/realtime.service';
import type { PlannerService } from './planner.service';

describe('OrchestratorService', () => {
  const prisma = {
    taskRun: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    taskStep: { update: jest.fn() },
  } as unknown as PrismaService;
  const planner = { synthesize: jest.fn() } as unknown as PlannerService;
  const specialists = { run: jest.fn() } as unknown as SpecialistService;
  const realtime = {
    emitTaskUpdated: jest.fn(),
    emitStepUpdated: jest.fn(),
    emitApprovalNeeded: jest.fn(),
  } as unknown as RealtimeService;

  let service: OrchestratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrchestratorService(
      prisma,
      planner,
      specialists,
      realtime,
    );
  });

  it('returns early when a step is waiting_approval', async () => {
    (prisma.taskRun.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 't1',
      goal: 'demo',
      bankCode: 'SHB',
      planJson: {
        summary: 'demo',
        steps: [
          {
            id: 'step-credit',
            agentRole: 'credit',
            goal: 'credit',
            dependsOn: [],
          },
        ],
      },
      steps: [
        {
          id: 'db-1',
          status: 'waiting_approval',
          input: { planStepId: 'step-credit' },
          output: null,
        },
      ],
    });

    await service.runTaskRun('t1');
    expect(specialists.run).not.toHaveBeenCalled();
    expect(realtime.emitTaskUpdated).toHaveBeenCalledWith('t1', {
      status: 'running',
    });
  });

  it('resumeTaskRun delegates to runTaskRun', async () => {
    const spy = jest.spyOn(service, 'runTaskRun').mockResolvedValue(undefined);
    await service.resumeTaskRun('t1');
    expect(spy).toHaveBeenCalledWith('t1');
  });
});
