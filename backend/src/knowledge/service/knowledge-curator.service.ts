import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../../llm/llm.gateway';
import { PrismaService } from '../../prisma/service/prisma.service';
import { isRagDomain, type RagDomain } from '../../rag/indexes';
import { RetrieveService } from '../../rag/service/retrieve.service';
import {
  ChangeProposalPayloadSchema,
  type ChangeProposalPayload,
} from '../schemas/change-proposal.schema';
import {
  buildHeuristicProposal,
  KnowledgeCuratorTools,
} from './knowledge-curator.tools';

@Injectable()
export class KnowledgeCuratorService {
  private readonly logger = new Logger(KnowledgeCuratorService.name);
  private readonly tools: KnowledgeCuratorTools;

  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieve: RetrieveService,
    private readonly llm: LlmGatewayService,
  ) {
    this.tools = new KnowledgeCuratorTools(prisma, retrieve);
  }

  /**
   * Run Curator tool loop for a job: parse → search/list/diff → propose → pending_review.
   * Never publishes; only creates KnowledgeChangeProposal.
   */
  async analyzeJob(jobId: string): Promise<{
    jobId: string;
    proposalId: string;
    status: string;
    payload: ChangeProposalPayload;
  }> {
    const job = await this.prisma.knowledgeIngestJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    if (!isRagDomain(job.domain)) {
      throw new Error(`Invalid domain on job ${jobId}: ${job.domain}`);
    }
    const domain = job.domain as RagDomain;

    await this.prisma.knowledgeIngestJob.update({
      where: { id: jobId },
      data: { status: 'parsing', errorMessage: null },
    });

    // Tool: parse_source
    const parsed = this.tools.parse_source({
      rawText: job.rawText,
      sourceUri: job.sourceUri,
      fileName: job.fileName,
    });

    await this.prisma.knowledgeIngestJob.update({
      where: { id: jobId },
      data: { status: 'analyzing' },
    });

    // Tools: list_active_documents + kb_search
    const activeDocs = await this.tools.list_active_documents({
      domain,
      bankCode: job.bankCode,
      includeSuperseded: false,
    });
    const search = await this.tools.kb_search({
      domain,
      bankCode: job.bankCode,
      query: `${parsed.title} ${parsed.metadata.documentCode ?? ''} ${parsed.sections
        .slice(0, 2)
        .map((s) => s.body)
        .join(' ')}`.slice(0, 500),
      limit: 5,
    });

    const candidateIds = new Set<string>([
      ...activeDocs.map((d) => d.id),
      ...search.hits.map((h) => h.docId),
    ]);

    const diffs: Array<{
      docId: string;
      title: string;
      diff: ReturnType<KnowledgeCuratorTools['diff_sections']>;
    }> = [];

    for (const docId of candidateIds) {
      // Tool: get_document
      const doc = await this.tools.get_document({
        docId,
        bankCode: job.bankCode,
      });
      if (!doc || doc.domain !== domain) continue;
      // Tool: diff_sections
      const diff = this.tools.diff_sections({
        sourceText: parsed.normalizedText,
        targetText: doc.content,
      });
      diffs.push({ docId: doc.id, title: doc.title, diff });
    }

    let payload = buildHeuristicProposal({
      domain,
      parsed,
      candidates: activeDocs,
      diffs,
    });

    // Optional LLM refinement of summary/operations (Zod-validated)
    if (this.llm.isPrimaryConfigured || this.llm.isFallbackConfigured) {
      try {
        const refined = await this.llm.generateObject({
          agentRole: 'knowledge_curator',
          purpose: 'knowledge_ingest_propose',
          schema: ChangeProposalPayloadSchema,
          system: `Bạn là Knowledge Curator của ngân hàng. Chỉ đề xuất thao tác tri thức trong domain ${domain}.
Không publish, không sửa MCP/agent catalog. Trả operations hợp lệ: create_doc|patch_doc|supersede_doc|amend_relation|replaces_clause|noop.
Mỗi operation cần id ổn định (op-1, op-2…). Giữ before/after excerpt khi patch/supersede.`,
          prompt: JSON.stringify({
            parsed,
            diffs: diffs.map((d) => ({
              docId: d.docId,
              title: d.title,
              similarity: d.diff.similarity,
              added: d.diff.added.slice(0, 5),
              removed: d.diff.removed.slice(0, 5),
              changed: d.diff.changed.slice(0, 5),
            })),
            heuristic: payload,
          }),
        });
        payload = this.tools.propose_operations(refined.object);
      } catch (err) {
        this.logger.warn(
          `LLM propose failed, using heuristic: ${err instanceof Error ? err.message : err}`,
        );
        payload = this.tools.propose_operations(payload);
      }
    } else {
      payload = this.tools.propose_operations(payload);
    }

    // Tool: flag_warnings (merge)
    const flagged = this.tools.flag_warnings({ warnings: payload.warnings });
    payload = { ...payload, warnings: flagged.warnings };

    const proposal = await this.prisma.knowledgeChangeProposal.upsert({
      where: { jobId },
      create: {
        jobId,
        bankCode: job.bankCode,
        domain,
        status: 'pending_review',
        summary: payload.summary,
        operationsJson: payload.operations,
        confidence: payload.confidence ?? null,
        warningsJson: payload.warnings,
      },
      update: {
        status: 'pending_review',
        summary: payload.summary,
        operationsJson: payload.operations,
        confidence: payload.confidence ?? null,
        warningsJson: payload.warnings,
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      },
    });

    await this.prisma.knowledgeIngestJob.update({
      where: { id: jobId },
      data: { status: 'pending_review' },
    });

    return {
      jobId,
      proposalId: proposal.id,
      status: 'pending_review',
      payload,
    };
  }
}
