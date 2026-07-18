import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from './embeddings/embeddings.service';

export type RagCitation = {
  sourceDoc: string;
  docId: string;
  section: string;
  score: number;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  relationNotes: string[];
  excerpt: string;
};

export type RagHit = RagCitation & {
  domain: string;
  vectorScore: number | null;
  ftsScore: number | null;
};

@Injectable()
export class RetrieveService {
  private readonly logger = new Logger(RetrieveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async retrieve(opts: {
    domain: string;
    query: string;
    bankCode?: string;
    limit?: number;
    /** Include superseded docs (version compare). Default false. */
    includeSuperseded?: boolean;
  }): Promise<{ hits: RagHit[]; mode: 'hybrid' | 'fts' | 'empty' }> {
    const bankCode = opts.bankCode ?? 'SHB';
    const limit = Math.min(opts.limit ?? 5, 10);
    const query = opts.query.trim();
    if (!query) return { hits: [], mode: 'empty' };

    const statuses = opts.includeSuperseded
      ? ['active', 'superseded']
      : ['active'];

    const queryEmb = await this.embeddings.embedOne(query);
    let rows: Array<{
      id: string;
      docId: string;
      domain: string;
      content: string;
      title: string;
      status: string;
      effectiveFrom: Date | null;
      effectiveTo: Date | null;
      vec_score: number | null;
      fts_score: number | null;
      hybrid: number;
    }> = [];

    if (queryEmb) {
      const embLiteral = `[${queryEmb.join(',')}]`;
      try {
        rows = await this.prisma.$queryRawUnsafe(
          `
          SELECT
            c.id,
            c."docId",
            c.domain,
            c.content,
            d.title,
            d.status,
            d."effectiveFrom",
            d."effectiveTo",
            (1 - (c.embedding <=> $1::vector))::float8 AS vec_score,
            ts_rank(c."searchVector", plainto_tsquery('simple', $2))::float8 AS fts_score,
            (
              0.7 * (1 - (c.embedding <=> $1::vector))
              + 0.3 * ts_rank(c."searchVector", plainto_tsquery('simple', $2))
            )::float8 AS hybrid
          FROM "KnowledgeChunk" c
          JOIN "KnowledgeDocument" d ON d.id = c."docId"
          WHERE c."bankCode" = $3
            AND c.domain = $4
            AND d.status = ANY($5::text[])
            AND c.embedding IS NOT NULL
          ORDER BY hybrid DESC
          LIMIT $6
          `,
          embLiteral,
          query,
          bankCode,
          opts.domain,
          statuses,
          limit,
        );
      } catch (err) {
        this.logger.warn(
          `Hybrid retrieve failed, falling back to FTS: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    let mode: 'hybrid' | 'fts' | 'empty' = rows.length ? 'hybrid' : 'empty';

    if (rows.length === 0) {
      rows = await this.prisma.$queryRawUnsafe(
        `
        SELECT
          c.id,
          c."docId",
          c.domain,
          c.content,
          d.title,
          d.status,
          d."effectiveFrom",
          d."effectiveTo",
          NULL::float8 AS vec_score,
          ts_rank(c."searchVector", plainto_tsquery('simple', $1))::float8 AS fts_score,
          ts_rank(c."searchVector", plainto_tsquery('simple', $1))::float8 AS hybrid
        FROM "KnowledgeChunk" c
        JOIN "KnowledgeDocument" d ON d.id = c."docId"
        WHERE c."bankCode" = $2
          AND c.domain = $3
          AND d.status = ANY($4::text[])
          AND c."searchVector" @@ plainto_tsquery('simple', $1)
        ORDER BY hybrid DESC
        LIMIT $5
        `,
        query,
        bankCode,
        opts.domain,
        statuses,
        limit,
      );
      mode = rows.length ? 'fts' : 'empty';
    }

    // Keyword ILIKE fallback if FTS empty (short Vietnamese queries)
    if (rows.length === 0) {
      const like = `%${query.split(/\s+/).slice(0, 3).join('%')}%`;
      rows = await this.prisma.$queryRawUnsafe(
        `
        SELECT
          c.id,
          c."docId",
          c.domain,
          c.content,
          d.title,
          d.status,
          d."effectiveFrom",
          d."effectiveTo",
          NULL::float8 AS vec_score,
          0.5::float8 AS fts_score,
          0.5::float8 AS hybrid
        FROM "KnowledgeChunk" c
        JOIN "KnowledgeDocument" d ON d.id = c."docId"
        WHERE c."bankCode" = $1
          AND c.domain = $2
          AND d.status = ANY($3::text[])
          AND (c.content ILIKE $4 OR d.title ILIKE $4)
        ORDER BY d."effectiveFrom" DESC NULLS LAST
        LIMIT $5
        `,
        bankCode,
        opts.domain,
        statuses,
        like,
        limit,
      );
      mode = rows.length ? 'fts' : 'empty';
    }

    const hits: RagHit[] = [];
    for (const r of rows) {
      const relationNotes = await this.relationNotes(r.docId);
      hits.push({
        sourceDoc: r.title,
        docId: r.docId,
        section: r.content.slice(0, 160),
        score: Number(r.hybrid ?? 0),
        status: r.status,
        effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
        effectiveTo: r.effectiveTo?.toISOString() ?? null,
        relationNotes,
        excerpt: r.content.slice(0, 320),
        domain: r.domain,
        vectorScore: r.vec_score != null ? Number(r.vec_score) : null,
        ftsScore: r.fts_score != null ? Number(r.fts_score) : null,
      });
    }

    return { hits, mode };
  }

  private async relationNotes(docId: string): Promise<string[]> {
    const rels = await this.prisma.documentRelation.findMany({
      where: { OR: [{ fromDocId: docId }, { toDocId: docId }] },
      include: {
        fromDoc: { select: { title: true, status: true } },
        toDoc: { select: { title: true, status: true } },
      },
    });
    return rels.map((rel) => {
      const base =
        rel.note ||
        `${rel.relationType}: ${rel.fromDoc.title} → ${rel.toDoc.title}`;
      if (rel.toDoc.status === 'superseded') {
        return `${base} (đã bị thay thế / superseded)`;
      }
      return base;
    });
  }
}
