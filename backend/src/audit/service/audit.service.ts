import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/service/prisma.service';

export type RecordAuditInput = {
  actorId: string;
  action: string;
  resource: string;
  bankCode?: string;
  detail?: Record<string, unknown> | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditInput) {
    return this.prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        resource: input.resource,
        bankCode: input.bankCode?.trim() || 'SHB',
        detailJson:
          input.detail === undefined || input.detail === null
            ? undefined
            : (input.detail as Prisma.InputJsonValue),
      },
    });
  }

  /** Fire-and-forget for mutation paths — never fail the business action. */
  recordSafe(input: RecordAuditInput) {
    void this.record(input).catch(() => undefined);
  }

  list(opts?: {
    bankCode?: string;
    limit?: number;
    action?: string;
    resource?: string;
    actorId?: string;
  }) {
    const bankCode = opts?.bankCode?.trim() || 'SHB';
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const action = opts?.action?.trim();
    const resource = opts?.resource?.trim();
    const actorId = opts?.actorId?.trim();

    return this.prisma.auditEvent.findMany({
      where: {
        bankCode,
        ...(action ? { action } : {}),
        ...(resource ? { resource } : {}),
        ...(actorId ? { actorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
