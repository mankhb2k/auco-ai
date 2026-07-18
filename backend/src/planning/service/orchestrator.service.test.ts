import { OrchestratorService } from './orchestrator.service';
import type { SpecialistService } from '../../agents/service/specialist.service';
import type { PrismaService } from '../../prisma/service/prisma.service';
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

  let service: OrchestratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrchestratorService(prisma, planner, specialists);
  });

  it('marks legacy waiting_approval steps as failed and finishes failed', async () => {
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
    (prisma.taskRun.update as jest.Mock).mockResolvedValue({});

    await service.runTaskRun('t1');
    expect(specialists.run).not.toHaveBeenCalled();
    expect(prisma.taskRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'failed' },
      }),
    );
  });

  it('synthesizes final answer when all steps complete', async () => {
    (prisma.taskRun.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 't1',
      goal: 'demo',
      bankCode: 'SHB',
      employeeId: 'emp-credit-b',
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
          status: 'pending',
          input: { planStepId: 'step-credit' },
          output: null,
        },
      ],
    });
    (prisma.taskRun.update as jest.Mock).mockResolvedValue({});
    (prisma.taskStep.update as jest.Mock).mockResolvedValue({});
    (specialists.run as jest.Mock).mockResolvedValue({
      mode: 'direct',
      toolCalls: [],
      output: { summary: 'ok', eligible: true },
    });
    (planner.synthesize as jest.Mock).mockResolvedValue({
      finalAnswer: 'Khuyến nghị: proceed_with_conditions.',
      usedLlm: false,
    });

    await service.runTaskRun('t1');

    expect(planner.synthesize).toHaveBeenCalled();
    expect(prisma.taskRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'done',
          finalAnswer: 'Khuyến nghị: proceed_with_conditions.',
        }),
      }),
    );
  });
});
