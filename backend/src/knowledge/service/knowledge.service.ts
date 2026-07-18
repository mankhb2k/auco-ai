import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/service/prisma.service';
import { isRagDomain } from '../../rag/indexes';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  list(opts?: { bankCode?: string; domain?: string; status?: string }) {
    const bankCode = opts?.bankCode?.trim() || 'SHB';
    const domain = opts?.domain?.trim();
    if (domain && !isRagDomain(domain)) {
      throw new BadRequestException(
        'domain must be one of credit|legal|collateral|product|ops',
      );
    }

    return this.prisma.knowledgeDocument.findMany({
      where: {
        bankCode,
        ...(domain ? { domain } : {}),
        ...(opts?.status?.trim() ? { status: opts.status.trim() } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        uploadedBy: {
          select: { id: true, displayName: true, role: true },
        },
      },
    });
  }

  async get(id: string, bankCode = 'SHB') {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id, bankCode },
      include: {
        uploadedBy: {
          select: { id: true, displayName: true, role: true },
        },
        relationsFrom: true,
        relationsTo: true,
      },
    });
    if (!document) {
      throw new NotFoundException(`KnowledgeDocument ${id} not found`);
    }
    return document;
  }
}
