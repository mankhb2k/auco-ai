import { AuditService } from './audit.service';
import type { PrismaService } from '../../prisma/service/prisma.service';

describe('AuditService', () => {
  const prisma = {
    auditEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma);
  });

  it('records actor/action/resource with bank default', async () => {
    (prisma.auditEvent.create as jest.Mock).mockResolvedValue({
      id: 'aud-1',
    });

    await service.record({
      actorId: 'emp-mgr-d',
      action: 'knowledge.publish',
      resource: 'KnowledgeDocument:doc-1',
      detail: { domain: 'credit' },
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actorId: 'emp-mgr-d',
        action: 'knowledge.publish',
        resource: 'KnowledgeDocument:doc-1',
        bankCode: 'SHB',
        detailJson: { domain: 'credit' },
      },
    });
  });

  it('lists newest events for bank with clamp', async () => {
    (prisma.auditEvent.findMany as jest.Mock).mockResolvedValue([]);

    await service.list({ bankCode: 'SHB', limit: 999, action: 'approval.approve' });

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith({
      where: { bankCode: 'SHB', action: 'approval.approve' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('recordSafe swallows persistence errors', async () => {
    (prisma.auditEvent.create as jest.Mock).mockRejectedValue(
      new Error('db down'),
    );

    expect(() =>
      service.recordSafe({
        actorId: 'emp-it-e',
        action: 'mcp.connector.set_enabled',
        resource: 'McpConnector:ops',
      }),
    ).not.toThrow();

    await Promise.resolve();
  });
});
