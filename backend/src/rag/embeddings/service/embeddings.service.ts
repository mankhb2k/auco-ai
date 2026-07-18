import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  /** text-embedding-3-small → 1536 dims (matches KnowledgeChunk.embedding) */
  readonly dimensions = 1536;

  constructor(private readonly config: ConfigService) {}

  /** Timeout cho 1 truy vấn embedding (RAG hot path). */
  private get queryTimeoutMs(): number {
    return Number(this.config.get('EMBEDDING_TIMEOUT_MS') ?? 20_000);
  }

  /** Timeout cho embedding hàng loạt (ingest). */
  private get batchTimeoutMs(): number {
    return Number(this.config.get('EMBEDDING_BATCH_TIMEOUT_MS') ?? 60_000);
  }

  get isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('OPENAI_API_KEY')?.trim() ||
        this.config.get<string>('GEMINI_API_KEY')?.trim() ||
        this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim(),
    );
  }

  get provider(): 'openai' | 'google' | 'none' {
    if (this.config.get<string>('OPENAI_API_KEY')?.trim()) return 'openai';
    if (
      this.config.get<string>('GEMINI_API_KEY')?.trim() ||
      this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim()
    ) {
      return 'google';
    }
    return 'none';
  }

  async embedOne(text: string): Promise<number[] | null> {
    if (!this.isConfigured) return null;
    try {
      const model = this.embeddingModel();
      if (!model) return null;
      const { embedding } = await embed({
        model,
        value: text,
        maxRetries: 2,
        abortSignal: AbortSignal.timeout(this.queryTimeoutMs),
      });
      return this.padOrTrim(embedding);
    } catch (err) {
      this.logger.warn(
        `embedOne failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async embedMany(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.isConfigured || texts.length === 0) {
      return texts.map(() => null);
    }
    try {
      const model = this.embeddingModel();
      if (!model) return texts.map(() => null);
      const { embeddings } = await embedMany({
        model,
        values: texts,
        maxRetries: 2,
        abortSignal: AbortSignal.timeout(this.batchTimeoutMs),
      });
      return embeddings.map((e) => this.padOrTrim(e));
    } catch (err) {
      this.logger.warn(
        `embedMany failed: ${err instanceof Error ? err.message : err}`,
      );
      return texts.map(() => null);
    }
  }

  private embeddingModel() {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (openaiKey) {
      const openai = createOpenAI({ apiKey: openaiKey });
      return openai.embedding(
        process.env.EMBEDDING_MODEL?.trim() || 'text-embedding-3-small',
      );
    }
    const googleKey =
      this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim() ||
      this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (googleKey) {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = googleKey;
      }
      const google = createGoogleGenerativeAI({ apiKey: googleKey });
      // Gemini embedding dims may differ — pad/trim to 1536 for schema
      return google.embedding(
        (process.env.EMBEDDING_MODEL?.trim() ||
          'gemini-embedding-001') as 'gemini-embedding-001',
      );
    }
    return null;
  }

  private padOrTrim(vec: number[]): number[] {
    if (vec.length === this.dimensions) return vec;
    if (vec.length > this.dimensions) return vec.slice(0, this.dimensions);
    return [...vec, ...Array(this.dimensions - vec.length).fill(0)];
  }
}
