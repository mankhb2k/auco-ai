import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmbeddingsService } from './embeddings/embeddings.service';
import { IngestService } from './ingest.service';
import { RetrieveService, type RagHit } from './retrieve.service';

export type DomainKbTool =
  | 'credit_kb_search'
  | 'legal_kb_search'
  | 'product_kb_search'
  | 'ops_kb_search';

const TOOL_DOMAIN: Record<DomainKbTool, string> = {
  credit_kb_search: 'credit',
  legal_kb_search: 'legal',
  product_kb_search: 'product',
  ops_kb_search: 'ops',
};

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly ingest: IngestService,
    private readonly retrieve: RetrieveService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.ingest.chunkCount('SHB');
      if (count === 0) {
        this.logger.log('No RAG chunks — running initial ingest…');
        await this.ingest.ingestAll({ bankCode: 'SHB' });
      } else {
        this.logger.log(`RAG ready: ${count} chunks (provider=${this.embeddings.provider})`);
      }
    } catch (err) {
      this.logger.warn(
        `RAG auto-ingest skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  ingestAll(bankCode?: string) {
    return this.ingest.ingestAll({ bankCode });
  }

  async search(opts: {
    domain: string;
    query: string;
    bankCode?: string;
    limit?: number;
    includeSuperseded?: boolean;
  }) {
    return this.retrieve.retrieve(opts);
  }

  async kbTool(
    tool: DomainKbTool,
    opts: {
      query: string;
      bankCode?: string;
      limit?: number;
      includeSuperseded?: boolean;
    },
  ): Promise<{
    tool: DomainKbTool;
    domain: string;
    mutates: false;
    mode: string;
    citations: RagHit[];
    summary: string;
  }> {
    const domain = TOOL_DOMAIN[tool];
    const { hits, mode } = await this.retrieve.retrieve({
      domain,
      query: opts.query,
      bankCode: opts.bankCode,
      limit: opts.limit,
      includeSuperseded: opts.includeSuperseded,
    });
    const summary =
      hits.length === 0
        ? `Không tìm thấy tài liệu domain=${domain} cho: ${opts.query}`
        : hits
            .slice(0, 3)
            .map(
              (h, i) =>
                `[${i + 1}] ${h.sourceDoc} (${h.status}, score=${h.score.toFixed(3)})${h.relationNotes.length ? ` — ${h.relationNotes[0]}` : ''}: ${h.excerpt}`,
            )
            .join('\n');

    return {
      tool,
      domain,
      mutates: false,
      mode,
      citations: hits,
      summary,
    };
  }

  status() {
    return {
      suite: 'RAG',
      embeddingProvider: this.embeddings.provider,
      embeddingConfigured: this.embeddings.isConfigured,
      dimensions: this.embeddings.dimensions,
    };
  }
}
