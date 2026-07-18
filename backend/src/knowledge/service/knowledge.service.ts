import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/service/prisma.service';
import { isRagDomain, type RagDomain } from '../../rag/indexes';
import { IngestService } from '../../rag/service/ingest.service';

export type CreateKnowledgeDraftDto = {
  title: string;
  domain: string;
  content: string;
  sourceUrl?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type UpdateKnowledgeDraftDto = Partial<CreateKnowledgeDraftDto>;

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingest: IngestService,
  ) {}

  list(opts?: { bankCode?: string; domain?: string; status?: string }) {
    const bankCode = opts?.bankCode?.trim() || 'SHB';
    const domain = opts?.domain?.trim();
    if (domain && !isRagDomain(domain)) {
      throw new BadRequestException(
        'domain must be one of credit|legal|product|ops',
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

  createDraft(
    dto: CreateKnowledgeDraftDto,
    actor: { id: string; bankCode: string },
  ) {
    const data = this.validateDraft(dto, true);
    return this.prisma.knowledgeDocument.create({
      data: {
        title: data.title!,
        domain: data.domain!,
        content: data.content!,
        sourceUrl: data.sourceUrl,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        bankCode: actor.bankCode,
        uploadedById: actor.id,
        status: 'draft',
        publishedAt: null,
      },
    });
  }

  async updateDraft(
    id: string,
    dto: UpdateKnowledgeDraftDto,
    bankCode: string,
  ) {
    const current = await this.getEditableDraft(id, bankCode);
    const data = this.validateDraft(dto, false);

    return this.prisma.knowledgeDocument.update({
      where: { id: current.id },
      data,
    });
  }

  async publish(id: string, bankCode: string) {
    const draft = await this.getEditableDraft(id, bankCode);
    const publishedAt = new Date();

    const document = await this.prisma.knowledgeDocument.update({
      where: { id: draft.id },
      data: {
        status: 'active',
        publishedAt,
        effectiveFrom: draft.effectiveFrom ?? publishedAt,
      },
    });

    try {
      const ingest = await this.ingest.ingestAll({ bankCode });
      return { document, ingest };
    } catch (error) {
      // Avoid a document appearing active while the live index was not rebuilt.
      await this.prisma.knowledgeDocument.update({
        where: { id: draft.id },
        data: {
          status: 'draft',
          publishedAt: null,
          effectiveFrom: draft.effectiveFrom,
        },
      });
      throw error;
    }
  }

  private async getEditableDraft(id: string, bankCode: string) {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id, bankCode },
    });
    if (!document) {
      throw new NotFoundException(`KnowledgeDocument ${id} not found`);
    }
    if (document.status !== 'draft') {
      throw new BadRequestException(
        `KnowledgeDocument ${id} status is ${document.status}; only draft can be edited or published`,
      );
    }
    return document;
  }

  private validateDraft(
    dto: UpdateKnowledgeDraftDto,
    requireAll: boolean,
  ): {
    title?: string;
    domain?: RagDomain;
    content?: string;
    sourceUrl?: string | null;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
  } {
    const title = dto.title?.trim();
    const content = dto.content?.trim();
    const domain = dto.domain?.trim();

    if (requireAll && !title) {
      throw new BadRequestException('title is required');
    }
    if (requireAll && !content) {
      throw new BadRequestException('content is required');
    }
    if (requireAll && !domain) {
      throw new BadRequestException('domain is required');
    }
    if (dto.title !== undefined && !title) {
      throw new BadRequestException('title cannot be empty');
    }
    if (dto.content !== undefined && !content) {
      throw new BadRequestException('content cannot be empty');
    }
    if (domain && !isRagDomain(domain)) {
      throw new BadRequestException(
        'domain must be one of credit|legal|product|ops',
      );
    }

    const effectiveFrom = this.parseDate(dto.effectiveFrom, 'effectiveFrom');
    const effectiveTo = this.parseDate(dto.effectiveTo, 'effectiveTo');
    if (
      effectiveFrom &&
      effectiveTo &&
      effectiveTo.getTime() < effectiveFrom.getTime()
    ) {
      throw new BadRequestException(
        'effectiveTo must be greater than or equal to effectiveFrom',
      );
    }

    return {
      ...(dto.title !== undefined ? { title } : {}),
      ...(dto.content !== undefined ? { content } : {}),
      ...(dto.domain !== undefined ? { domain: domain as RagDomain } : {}),
      ...(dto.sourceUrl !== undefined
        ? { sourceUrl: dto.sourceUrl?.trim() || null }
        : {}),
      ...(dto.effectiveFrom !== undefined ? { effectiveFrom } : {}),
      ...(dto.effectiveTo !== undefined ? { effectiveTo } : {}),
    };
  }

  private parseDate(
    value: string | null | undefined,
    field: string,
  ): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || !value.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return date;
  }
}
