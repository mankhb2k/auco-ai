import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import type { AuditService } from '../../audit/service/audit.service';
import type { McpGatewayService } from '../../mcp-client/service/mcp-gateway.service';
import type { OrchestratorService } from '../../planning/service/orchestrator.service';
import type { PrismaService } from '../../prisma/service/prisma.service';
import type { RealtimeService } from '../../realtime/service/realtime.service';

describe('ApprovalsService', () => {
  const prisma = {
    taskStep: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    taskRun: { update: jest.fn() },
  } as unknown as PrismaService;
  const mcp = { callTool: jest.fn() } as unknown as McpGatewayService;
  const orchestrator = {
    resumeTaskRun: jest.fn(),
  } as unknown as OrchestratorService;
  const realtime = {
    emitStepUpdated: jest.fn(),
    emitTaskUpdated: jest.fn(),
  } as unknown as RealtimeService;
  const audit = { recordSafe: jest.fn() } as unknown as AuditService;

  let service: ApprovalsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApprovalsService(prisma, mcp, orchestrator, realtime, audit);
  });

  it('listPending queries waiting_approval steps', async () => {
    (prisma.taskStep.findMany as jest.Mock).mockResolvedValue([]);
    await service.listPending('task-1');
    expect(prisma.taskStep.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'waiting_approval', taskRunId: 'task-1' },
      }),
    );
  });

  it('approve throws NotFound when step missing', async () => {
    (prisma.taskStep.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.approve('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('approve throws BadRequest when status is not waiting_approval', async () => {
    (prisma.taskStep.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      status: 'done',
      output: {},
      taskRun: { bankCode: 'SHB' },
    });
    await expect(service.approve('s1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('approve grants out-of-portfolio access then resumes task', async () => {
    const waitingStep = {
      id: 's-portfolio',
      taskRunId: 't1',
      status: 'waiting_approval',
      toolCalls: [{ status: 'pending_approval' }],
      output: {
        summary: 'outside portfolio',
        pendingApproval: {
          reason: 'out_of_portfolio_access',
          preview: 'request access',
          tool: 'grant_portfolio_access',
          args: { customerNo: 'SHB-KH-9999' },
          agentRole: 'credit',
        },
      },
      taskRun: {
        id: 't1',
        bankCode: 'SHB',
        planJson: { summary: 'demo', portfolioGrants: [] },
      },
    };
    (prisma.taskStep.findUnique as jest.Mock)
      .mockResolvedValueOnce(waitingStep)
      .mockResolvedValueOnce({ id: 's-portfolio', status: 'done' });
    (prisma.taskRun.update as jest.Mock).mockResolvedValue({});
    (prisma.taskStep.update as jest.Mock).mockResolvedValue({});
    (orchestrator.resumeTaskRun as jest.Mock).mockResolvedValue(undefined);

    const result = await service.approve('s-portfolio', 'emp-mgr-d');

    expect(mcp.callTool).not.toHaveBeenCalled();
    expect(prisma.taskRun.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: {
        planJson: expect.objectContaining({
          portfolioGrants: ['SHB-KH-9999'],
        }),
      },
    });
    expect(prisma.taskStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's-portfolio' },
        data: expect.objectContaining({ status: 'pending' }),
      }),
    );
    expect(orchestrator.resumeTaskRun).toHaveBeenCalledWith('t1');
    expect(result).toEqual({ id: 's-portfolio', status: 'done' });
  });

  it('reject marks step and task failed', async () => {
    (prisma.taskStep.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 's1',
        taskRunId: 't1',
        status: 'waiting_approval',
        output: {
          summary: 'pending',
          pendingApproval: {
            reason: 'mutates',
            preview: 'create ticket',
            tool: 'create_service_ticket',
            args: {},
            agentRole: 'ops',
          },
        },
        taskRun: { bankCode: 'SHB' },
      })
      .mockResolvedValueOnce({ id: 's1', status: 'failed' });
    (prisma.taskStep.update as jest.Mock).mockResolvedValue({});
    (prisma.taskRun.update as jest.Mock).mockResolvedValue({});

    const result = await service.reject('s1', { reason: 'Không đồng ý' });
    expect(prisma.taskStep.update).toHaveBeenCalled();
    expect(realtime.emitTaskUpdated).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ status: 'failed', rejected: true }),
    );
    expect(result).toEqual({ id: 's1', status: 'failed' });
  });
});
