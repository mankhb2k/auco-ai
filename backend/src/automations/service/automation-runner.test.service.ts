import { AutomationRunnerService } from './automation-runner.service';
import type { LlmGatewayService } from '../../llm/llm.gateway';
import type { PrismaService } from '../../prisma/service/prisma.service';
import type { RealtimeService } from '../../realtime/service/realtime.service';

describe('AutomationRunnerService', () => {
  const prisma = {
    automation: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    automationRun: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    customer: { findMany: jest.fn() },
  } as unknown as PrismaService;
  const llm = { generateText: jest.fn() } as unknown as LlmGatewayService;
  const realtime = {
    emitAutomationRunUpdated: jest.fn(),
  } as unknown as RealtimeService;

  let service: AutomationRunnerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AutomationRunnerService(prisma, llm, realtime);
    (prisma.automationRun.create as jest.Mock).mockResolvedValue({
      id: 'run-1',
      status: 'running',
    });
    (prisma.automationRun.update as jest.Mock).mockResolvedValue({
      id: 'run-1',
      status: 'done',
    });
    (prisma.automationRun.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'run-1',
      status: 'done',
    });
    (prisma.automation.update as jest.Mock).mockResolvedValue({});
  });

  it('runs trigger.cron graph step and completes', async () => {
    (prisma.automation.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'a1',
      name: 'Weekly FX',
      bankCode: 'SHB',
      enabled: true,
      cronExpr: '0 8 * * 1',
      timezone: 'Asia/Ho_Chi_Minh',
      nextRunAt: null,
      graphJson: { steps: [{ type: 'trigger.cron' }] },
    });

    const result = await service.run('a1', {
      trigger: 'manual',
      actorId: 'demo-user',
    });

    expect(realtime.emitAutomationRunUpdated).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ runId: 'run-1', status: 'running' }),
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'done' }),
      }),
    );
    expect(result).toEqual({ id: 'run-1', status: 'done' });
  });
});
