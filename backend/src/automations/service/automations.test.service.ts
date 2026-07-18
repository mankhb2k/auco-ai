import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AutomationsService } from './automations.service';
import type { AutomationRunnerService } from './automation-runner.service';
import type { PrismaService } from '../../prisma/service/prisma.service';

describe('AutomationsService', () => {
  const prisma = {
    automation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    automationRun: { findMany: jest.fn() },
  } as unknown as PrismaService;
  const runner = { run: jest.fn() } as unknown as AutomationRunnerService;
  let service: AutomationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AutomationsService(prisma, runner);
  });

  it('list filters by bankCode', async () => {
    (prisma.automation.findMany as jest.Mock).mockResolvedValue([]);
    await service.list('SHB');
    expect(prisma.automation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bankCode: 'SHB' } }),
    );
  });

  it('get throws NotFound when missing', async () => {
    (prisma.automation.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('patch enables automation and sets active status', async () => {
    (prisma.automation.findUnique as jest.Mock).mockResolvedValue({
      id: 'a1',
      enabled: false,
      cronExpr: '0 8 * * 1',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'paused',
    });
    (prisma.automation.update as jest.Mock).mockResolvedValue({
      id: 'a1',
      enabled: true,
      status: 'active',
    });
    const result = await service.patch('a1', { enabled: true });
    expect(prisma.automation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enabled: true, status: 'active' }),
      }),
    );
    expect(result.enabled).toBe(true);
  });

  it('runNow throws when graphJson is missing', async () => {
    (prisma.automation.findUnique as jest.Mock).mockResolvedValue({
      id: 'a1',
      graphJson: null,
    });
    await expect(service.runNow('a1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('runNow delegates to runner', async () => {
    (prisma.automation.findUnique as jest.Mock).mockResolvedValue({
      id: 'a1',
      graphJson: { steps: [] },
    });
    (runner.run as jest.Mock).mockResolvedValue({ id: 'run-1' });
    const result = await service.runNow('a1', 'actor-1');
    expect(runner.run).toHaveBeenCalledWith('a1', {
      trigger: 'manual',
      actorId: 'actor-1',
    });
    expect(result).toEqual({ id: 'run-1' });
  });
});
