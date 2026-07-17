import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from './embeddings/embeddings.service';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Re-embed all KnowledgeDocuments into KnowledgeChunk (pgvector). */
  async ingestAll(opts?: { bankCode?: string }): Promise<{
    docs: number;
    chunks: number;
    embedded: number;
    provider: string;
  }> {
    const bankCode = opts?.bankCode ?? 'SHB';
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { bankCode },
      orderBy: { id: 'asc' },
    });

    // Clear existing chunks for bank
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "KnowledgeChunk" WHERE "bankCode" = $1`,
      bankCode,
    );

    let chunks = 0;
    let embedded = 0;

    for (const doc of docs) {
      const pieces = chunkText(`${doc.title}\n\n${doc.content}`);
      const vectors = await this.embeddings.embedMany(pieces);

      for (let i = 0; i < pieces.length; i++) {
        const id = chunkId(doc.id, i);
        const content = pieces[i]!;
        const vector = vectors[i];
        const embLiteral =
          vector && vector.length
            ? `[${vector.join(',')}]`
            : null;

        if (embLiteral) {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "KnowledgeChunk"
              ("id", "docId", "bankCode", "domain", "chunkIndex", "content", "embedding", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7::vector, NOW())`,
            id,
            doc.id,
            bankCode,
            doc.domain,
            i,
            content,
            embLiteral,
          );
          embedded += 1;
        } else {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "KnowledgeChunk"
              ("id", "docId", "bankCode", "domain", "chunkIndex", "content", "embedding", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, NULL, NOW())`,
            id,
            doc.id,
            bankCode,
            doc.domain,
            i,
            content,
          );
        }
        chunks += 1;
      }
    }

    this.logger.log(
      `Ingested docs=${docs.length} chunks=${chunks} embedded=${embedded} provider=${this.embeddings.provider}`,
    );
    return {
      docs: docs.length,
      chunks,
      embedded,
      provider: this.embeddings.provider,
    };
  }

  async chunkCount(bankCode = 'SHB'): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "KnowledgeChunk" WHERE "bankCode" = $1`,
      bankCode,
    );
    return Number(rows[0]?.count ?? 0);
  }
}

function chunkId(docId: string, index: number): string {
  return createHash('sha1').update(`${docId}#${index}`).digest('hex').slice(0, 24);
}

/** Short docs → usually 1 chunk; longer → ~600 char windows. */
export function chunkText(text: string, size = 600, overlap = 80): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= size) return [cleaned];
  const out: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    out.push(cleaned.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}
