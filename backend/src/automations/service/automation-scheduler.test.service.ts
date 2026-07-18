import { AutomationSchedulerService } from './automation-scheduler.service';
import type { AutomationRunnerService } from './automation-runner.service';
import type { PrismaService } from '../../prisma/service/prisma.service';

describe('AutomationSchedulerService', () => {
  const prisma = {
    automation: { findMany: jest.fn() },
  } as unknown as PrismaService;
  const runner = { run: jest.fn() } as unknown as AutomationRunnerService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts interval on init and clears on destroy', () => {
    const service = new AutomationSchedulerService(prisma, runner);
    const setSpy = jest.spyOn(global, 'setInterval');
    const clearSpy = jest.spyOn(global, 'clearInterval');
    service.onModuleInit();
    expect(setSpy).toHaveBeenCalled();
    service.onModuleDestroy();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('tick runs due automations', async () => {
    (prisma.automation.findMany as jest.Mock).mockResolvedValue([
      { id: 'a1', name: 'Weekly FX' },
    ]);
    (runner.run as jest.Mock).mockResolvedValue({ id: 'r1' });
    const service = new AutomationSchedulerService(prisma, runner);
    await (service as unknown as { tick: () => Promise<void> }).tick();
    expect(runner.run).toHaveBeenCalledWith('a1', {
      trigger: 'schedule',
      actorId: 'scheduler',
    });
  });
});
