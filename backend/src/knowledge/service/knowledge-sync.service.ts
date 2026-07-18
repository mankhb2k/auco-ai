import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/service/audit.service';
import { PrismaService } from '../../prisma/service/prisma.service';
import { isRagDomain } from '../../rag/indexes';
import { IngestService } from '../../rag/service/ingest.service';
import { BankHqService } from './bank-hq.service';

/**
 * Đồng bộ tri thức chuẩn hóa từ API hội sở (mock JSON) vào KnowledgeDocument,
 * sau đó re-index RAG. Nguồn hội sở là source of truth: tài liệu cùng id
 * sẽ bị ghi đè theo phiên bản hội sở.
 */
@Injectable()
export class KnowledgeSyncService {
  private readonly logger = new Logger(KnowledgeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankHq: BankHqService,
    private readonly ingest: IngestService,
    private readonly audit: AuditService,
  ) {}

  async syncFromHq(actor?: { id: string; bankCode: string }) {
    const bankCode = actor?.bankCode ?? 'SHB';
    const payload = this.bankHq.fetchKnowledge();

    let upserted = 0;
    let skipped = 0;
    for (const doc of payload.documents) {
      if (doc.bankCode !== bankCode || !isRagDomain(doc.domain)) {
        skipped += 1;
        continue;
      }
      const publishedAt =
        doc.status === 'active'
          ? new Date(payload.meta.updatedAt)
          : null;
      const data = {
        domain: doc.domain,
        bankCode,
        title: doc.title,
        sourceUrl: doc.sourceUrl,
        content: doc.content,
        status: doc.status,
        effectiveFrom: doc.effectiveFrom ? new Date(doc.effectiveFrom) : null,
        effectiveTo: doc.effectiveTo ? new Date(doc.effectiveTo) : null,
        publishedAt,
      };
      await this.prisma.knowledgeDocument.upsert({
        where: { id: doc.id },
        update: data,
        create: { id: doc.id, ...data },
      });
      upserted += 1;
    }

    const ingest = await this.ingest.ingestAll({ bankCode });

    this.audit.recordSafe({
      actorId: actor?.id ?? 'system',
      bankCode,
      action: 'knowledge.sync_hq',
      resource: `BankHqKnowledge:${payload.meta.version}`,
      detail: {
        version: payload.meta.version,
        documents: upserted,
        skipped,
        chunks: ingest.chunks,
      },
    });
    this.logger.log(
      `HQ sync v${payload.meta.version}: upserted=${upserted} skipped=${skipped} chunks=${ingest.chunks}`,
    );

    return {
      source: payload.meta.source,
      version: payload.meta.version,
      publishedBy: payload.meta.publishedBy,
      updatedAt: payload.meta.updatedAt,
      documents: upserted,
      skipped,
      ingest,
    };
  }
}
