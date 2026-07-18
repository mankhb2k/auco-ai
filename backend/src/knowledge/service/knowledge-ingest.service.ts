import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/service/audit.service';
import { PrismaService } from '../../prisma/service/prisma.service';
import { isRagDomain } from '../../rag/indexes';
import { IngestService } from '../../rag/service/ingest.service';
import {
  CreateIngestJobDtoSchema,
  KnowledgeOperationSchema,
  ReviewProposalDtoSchema,
  type CreateIngestJobDto,
  type KnowledgeOperation,
  type ReviewProposalDto,
} from '../schemas/change-proposal.schema';
import { KnowledgeCuratorService } from './knowledge-curator.service';

@Injectable()
export class KnowledgeIngestService {
  private readonly logger = new Logger(KnowledgeIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly curator: KnowledgeCuratorService,
    private readonly ingest: IngestService,
    private readonly audit: AuditService,
  ) {}

  async createJob(
    dto: CreateIngestJobDto,
    actor: { id: string; bankCode: string },
  ) {
    const parsed = CreateIngestJobDtoSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const data = parsed.data;

    let rawText = data.rawText?.trim() ?? '';
    if (data.sourceType === 'url') {
      if (!data.sourceUri) {
        throw new BadRequestException('sourceUri is required for url source');
      }
      if (!rawText) {
        rawText = await this.fetchUrlText(data.sourceUri);
      }
    }
    if (!rawText) {
      throw new BadRequestException('rawText is required (upload content or fetched URL body)');
    }

    const job = await this.prisma.knowledgeIngestJob.create({
      data: {
        bankCode: actor.bankCode,
        domain: data.domain,
        sourceType: data.sourceType,
        sourceUri: data.sourceUri ?? null,
        fileName: data.fileName ?? null,
        rawText,
        status: 'queued',
        createdById: actor.id,
      },
    });

    this.audit.recordSafe({
      actorId: actor.id,
      bankCode: actor.bankCode,
      action: 'knowledge.ingest.create',
      resource: `KnowledgeIngestJob:${job.id}`,
      detail: {
        domain: job.domain,
        sourceType: job.sourceType,
        fileName: job.fileName,
      },
    });

    try {
      const result = await this.curator.analyzeJob(job.id);
      return this.getJob(job.id, actor.bankCode, result.proposalId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Analyze failed for job ${job.id}: ${message}`);
      await this.prisma.knowledgeIngestJob.update({
        where: { id: job.id },
        data: { status: 'failed', errorMessage: message },
      });
      throw err;
    }
  }

  listJobs(opts: { bankCode: string; domain?: string; status?: string }) {
    if (opts.domain && !isRagDomain(opts.domain)) {
      throw new BadRequestException(
        'domain must be one of credit|legal|product|ops',
      );
    }
    return this.prisma.knowledgeIngestJob.findMany({
      where: {
        bankCode: opts.bankCode,
        ...(opts.domain ? { domain: opts.domain } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        proposal: {
          select: {
            id: true,
            status: true,
            summary: true,
            confidence: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getJob(id: string, bankCode: string, _proposalId?: string) {
    const job = await this.prisma.knowledgeIngestJob.findFirst({
      where: { id, bankCode },
      include: { proposal: true, createdBy: { select: { id: true, displayName: true } } },
    });
    if (!job) throw new NotFoundException(`KnowledgeIngestJob ${id} not found`);
    return job;
  }

  listProposals(opts: {
    bankCode: string;
    domain?: string;
    status?: string;
  }) {
    if (opts.domain && !isRagDomain(opts.domain)) {
      throw new BadRequestException(
        'domain must be one of credit|legal|product|ops',
      );
    }
    return this.prisma.knowledgeChangeProposal.findMany({
      where: {
        bankCode: opts.bankCode,
        ...(opts.domain ? { domain: opts.domain } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          select: {
            id: true,
            sourceType: true,
            sourceUri: true,
            fileName: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getProposal(id: string, bankCode: string) {
    const proposal = await this.prisma.knowledgeChangeProposal.findFirst({
      where: { id, bankCode },
      include: {
        job: true,
        reviewedBy: { select: { id: true, displayName: true } },
      },
    });
    if (!proposal) {
      throw new NotFoundException(`KnowledgeChangeProposal ${id} not found`);
    }
    return proposal;
  }

  async approve(
    id: string,
    actor: { id: string; bankCode: string },
    dto?: ReviewProposalDto,
  ) {
    const review = ReviewProposalDtoSchema.safeParse(dto ?? {});
    if (!review.success) {
      throw new BadRequestException(review.error.flatten());
    }

    const proposal = await this.getProposal(id, actor.bankCode);
    if (proposal.status !== 'pending_review') {
      throw new BadRequestException(
        `Proposal ${id} status is ${proposal.status}; only pending_review can be approved`,
      );
    }

    const operations = this.parseOperations(proposal.operationsJson);
    const selectedIds = review.data.selectedOperationIds;
    const toApply = selectedIds?.length
      ? operations.filter((op) => selectedIds.includes(op.id) && op.type !== 'noop')
      : operations.filter((op) => op.selected !== false && op.type !== 'noop');

    const appliedDocIds: string[] = [];
    const relationIds: string[] = [];
    let lastDocId: string | undefined;

    try {
      for (const op of toApply) {
        const result = await this.applyOperation(op, {
          bankCode: actor.bankCode,
          domain: proposal.domain,
          actorId: actor.id,
          sourceUri: proposal.job.sourceUri,
          lastDocId,
        });
        if (result.docId) {
          appliedDocIds.push(result.docId);
          lastDocId = result.docId;
        }
        if (result.relationId) relationIds.push(result.relationId);
      }

      const ingest =
        appliedDocIds.length > 0
          ? await this.ingest.ingestAll({ bankCode: actor.bankCode })
          : { docs: 0, chunks: 0, embedded: 0, provider: 'skipped' };

      const updated = await this.prisma.knowledgeChangeProposal.update({
        where: { id: proposal.id },
        data: {
          status: 'approved',
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reviewNote: review.data.reviewNote ?? null,
        },
        include: { job: true },
      });

      await this.prisma.knowledgeIngestJob.update({
        where: { id: proposal.jobId },
        data: { status: 'applied' },
      });

      this.audit.recordSafe({
        actorId: actor.id,
        bankCode: actor.bankCode,
        action: 'knowledge.proposal.approve',
        resource: `KnowledgeChangeProposal:${proposal.id}`,
        detail: {
          domain: proposal.domain,
          appliedDocIds,
          relationIds,
          operationCount: toApply.length,
        },
      });
      for (const docId of appliedDocIds) {
        this.audit.recordSafe({
          actorId: actor.id,
          bankCode: actor.bankCode,
          action: 'knowledge.publish',
          resource: `KnowledgeDocument:${docId}`,
          detail: { via: 'proposal', proposalId: proposal.id },
        });
      }

      return { proposal: updated, ingest, appliedDocIds, relationIds };
    } catch (err) {
      this.logger.error(
        `Approve apply failed for ${id}: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }

  async reject(
    id: string,
    actor: { id: string; bankCode: string },
    dto?: ReviewProposalDto,
  ) {
    const review = ReviewProposalDtoSchema.safeParse(dto ?? {});
    if (!review.success) {
      throw new BadRequestException(review.error.flatten());
    }

    const proposal = await this.getProposal(id, actor.bankCode);
    if (proposal.status !== 'pending_review') {
      throw new BadRequestException(
        `Proposal ${id} status is ${proposal.status}; only pending_review can be rejected`,
      );
    }

    const updated = await this.prisma.knowledgeChangeProposal.update({
      where: { id: proposal.id },
      data: {
        status: 'rejected',
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewNote: review.data.reviewNote ?? null,
      },
      include: { job: true },
    });

    await this.prisma.knowledgeIngestJob.update({
      where: { id: proposal.jobId },
      data: { status: 'rejected' },
    });

    this.audit.recordSafe({
      actorId: actor.id,
      bankCode: actor.bankCode,
      action: 'knowledge.proposal.reject',
      resource: `KnowledgeChangeProposal:${proposal.id}`,
      detail: { domain: proposal.domain, note: review.data.reviewNote },
    });

    return { proposal: updated };
  }

  private parseOperations(raw: unknown): KnowledgeOperation[] {
    if (!Array.isArray(raw)) {
      throw new BadRequestException('operationsJson must be an array');
    }
    return raw.map((item, index) => {
      const parsed = KnowledgeOperationSchema.safeParse(item);
      if (!parsed.success) {
        throw new BadRequestException(
          `Invalid operation at index ${index}: ${parsed.error.message}`,
        );
      }
      return parsed.data;
    });
  }

  private async applyOperation(
    op: KnowledgeOperation,
    ctx: {
      bankCode: string;
      domain: string;
      actorId: string;
      sourceUri: string | null;
      lastDocId?: string;
    },
  ): Promise<{ docId?: string; relationId?: string }> {
    switch (op.type) {
      case 'create_doc': {
        if (!op.content?.trim()) {
          throw new BadRequestException(`create_doc ${op.id} missing content`);
        }
        const doc = await this.prisma.knowledgeDocument.create({
          data: {
            bankCode: ctx.bankCode,
            domain: ctx.domain,
            title: op.title,
            content: op.content,
            sourceUrl: ctx.sourceUri,
            status: 'active',
            publishedAt: new Date(),
            effectiveFrom: new Date(),
            uploadedById: ctx.actorId,
          },
        });
        return { docId: doc.id };
      }
      case 'patch_doc': {
        if (!op.targetDocId) {
          throw new BadRequestException(`patch_doc ${op.id} missing targetDocId`);
        }
        if (!op.content?.trim()) {
          throw new BadRequestException(`patch_doc ${op.id} missing content`);
        }
        const existing = await this.prisma.knowledgeDocument.findFirst({
          where: {
            id: op.targetDocId,
            bankCode: ctx.bankCode,
            domain: ctx.domain,
          },
        });
        if (!existing) {
          throw new NotFoundException(
            `Target document ${op.targetDocId} not found`,
          );
        }
        const doc = await this.prisma.knowledgeDocument.update({
          where: { id: existing.id },
          data: {
            content: op.content,
            title: op.title || existing.title,
            status: 'active',
            publishedAt: existing.publishedAt ?? new Date(),
            updatedAt: new Date(),
          },
        });
        return { docId: doc.id };
      }
      case 'supersede_doc': {
        if (!op.targetDocId) {
          throw new BadRequestException(
            `supersede_doc ${op.id} missing targetDocId`,
          );
        }
        if (!op.content?.trim()) {
          throw new BadRequestException(
            `supersede_doc ${op.id} missing content`,
          );
        }
        const old = await this.prisma.knowledgeDocument.findFirst({
          where: {
            id: op.targetDocId,
            bankCode: ctx.bankCode,
            domain: ctx.domain,
          },
        });
        if (!old) {
          throw new NotFoundException(
            `Target document ${op.targetDocId} not found`,
          );
        }
        await this.prisma.knowledgeDocument.update({
          where: { id: old.id },
          data: {
            status: 'superseded',
            effectiveTo: new Date(),
          },
        });
        const neu = await this.prisma.knowledgeDocument.create({
          data: {
            bankCode: ctx.bankCode,
            domain: ctx.domain,
            title: op.title,
            content: op.content,
            sourceUrl: ctx.sourceUri,
            status: 'active',
            publishedAt: new Date(),
            effectiveFrom: new Date(),
            uploadedById: ctx.actorId,
          },
        });
        const rel = await this.prisma.documentRelation.create({
          data: {
            fromDocId: neu.id,
            toDocId: old.id,
            relationType: op.relationType ?? 'supersedes',
            note: op.relationNote ?? `Supersedes ${old.title}`,
          },
        });
        return { docId: neu.id, relationId: rel.id };
      }
      case 'amend_relation':
      case 'replaces_clause': {
        if (!op.targetDocId) {
          throw new BadRequestException(
            `${op.type} ${op.id} missing targetDocId`,
          );
        }
        // Prefer doc created/patched earlier in this approve batch; only create when needed.
        let fromDocId = ctx.lastDocId;
        if (!fromDocId && op.content?.trim()) {
          const from = await this.prisma.knowledgeDocument.create({
            data: {
              bankCode: ctx.bankCode,
              domain: ctx.domain,
              title: op.title,
              content: op.content,
              sourceUrl: ctx.sourceUri,
              status: 'active',
              publishedAt: new Date(),
              effectiveFrom: new Date(),
              uploadedById: ctx.actorId,
            },
          });
          fromDocId = from.id;
        }
        if (!fromDocId) {
          throw new BadRequestException(
            `${op.type} ${op.id} needs a prior create/patch/supersede or content`,
          );
        }
        const rel = await this.prisma.documentRelation.create({
          data: {
            fromDocId,
            toDocId: op.targetDocId,
            relationType:
              op.relationType ??
              (op.type === 'replaces_clause' ? 'replaces_clause' : 'amends'),
            note: op.relationNote,
          },
        });
        return { docId: fromDocId, relationId: rel.id };
      }
      case 'noop':
        return {};
      default:
        throw new BadRequestException(`Unknown operation type`);
    }
  }

  private async fetchUrlText(url: string): Promise<string> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'auco-knowledge-ingest/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        throw new BadRequestException(
          `Failed to fetch URL (${res.status}): ${url}`,
        );
      }
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length < 40) {
        throw new BadRequestException('Fetched URL content too short');
      }
      return text.slice(0, 80_000);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Cannot fetch URL: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
