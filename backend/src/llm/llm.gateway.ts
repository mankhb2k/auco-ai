import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import {
  generateObject,
  generateText,
  type LanguageModel,
  type ModelMessage,
} from 'ai';
import type { z } from 'zod';
import type { LlmEnvConfig } from './llm.config';
import {
  LlmGatewayError,
  type LlmAttemptTrace,
  type LlmCallTrace,
  type LlmObjectResult,
  type LlmProvider,
  type LlmTextResult,
} from './llm.types';

export type LlmCallOpts = {
  agentRole?: string;
  purpose?: string;
  system?: string;
  messages?: ModelMessage[];
  prompt?: string;
  temperature?: number;
};

@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);
  private readonly cfg: LlmEnvConfig;

  constructor(private readonly config: ConfigService) {
    this.cfg = this.config.getOrThrow<LlmEnvConfig>('llm');
    if (this.cfg.googleApiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = this.cfg.googleApiKey;
    }
  }

  get isPrimaryConfigured(): boolean {
    return Boolean(this.cfg.openaiApiKey);
  }

  get isFallbackConfigured(): boolean {
    return Boolean(this.cfg.googleApiKey);
  }

  getStatus() {
    return {
      primary: {
        provider: this.cfg.defaultProvider,
        model: this.cfg.defaultModel,
        configured: this.isPrimaryConfigured,
      },
      fallback: {
        provider: this.cfg.fallbackProvider,
        model: this.cfg.fallbackModel,
        configured: this.isFallbackConfigured,
      },
      smokeEnabled: this.cfg.smokeEnabled,
    };
  }

  async generateText(opts: LlmCallOpts): Promise<LlmTextResult> {
    const { value, trace } = await this.withFailover(opts, async (model) => {
      const result = await generateText({
        model,
        system: opts.system,
        temperature: opts.temperature ?? 0.2,
        abortSignal: AbortSignal.timeout(this.cfg.requestTimeoutMs),
        ...(opts.messages
          ? { messages: opts.messages }
          : { prompt: opts.prompt ?? '' }),
      });
      return result.text;
    });
    return { text: value, trace };
  }

  async generateObject<SCHEMA extends z.ZodType>(
    opts: LlmCallOpts & { schema: SCHEMA },
  ): Promise<LlmObjectResult<z.infer<SCHEMA>>> {
    const { schema, ...rest } = opts;
    const { value, trace } = await this.withFailover(rest, async (model) => {
      const result = await generateObject({
        model,
        schema,
        system: opts.system,
        temperature: opts.temperature ?? 0.1,
        abortSignal: AbortSignal.timeout(this.cfg.requestTimeoutMs),
        ...(opts.messages
          ? { messages: opts.messages }
          : { prompt: opts.prompt ?? '' }),
      });
      return result.object as z.infer<SCHEMA>;
    });
    return { object: value, trace };
  }

  private async withFailover<T>(
    opts: LlmCallOpts,
    run: (model: LanguageModel) => Promise<T>,
  ): Promise<{ value: T; trace: LlmCallTrace }> {
    const attempts: LlmAttemptTrace[] = [];
    const chain: Array<{ provider: LlmProvider; model: string }> = [
      {
        provider: this.cfg.defaultProvider,
        model: this.cfg.defaultModel,
      },
    ];

    if (this.isFallbackConfigured) {
      chain.push({
        provider: this.cfg.fallbackProvider,
        model: this.cfg.fallbackModel,
      });
    }

    let lastError: unknown;

    for (const slot of chain) {
      const maxTries =
        slot.provider === this.cfg.defaultProvider
          ? Math.max(1, this.cfg.maxRetriesPrimary)
          : 1;

      if (slot.provider === 'openai' && !this.isPrimaryConfigured) {
        attempts.push({
          provider: slot.provider,
          model: slot.model,
          attempt: 1,
          ok: false,
          errorCode: 'MISSING_API_KEY',
          errorMessage: 'OPENAI_API_KEY is not set',
        });
        continue;
      }

      for (let attempt = 1; attempt <= maxTries; attempt++) {
        const started = Date.now();
        try {
          const model = this.resolveModel(slot.provider, slot.model);
          const value = await run(model);
          attempts.push({
            provider: slot.provider,
            model: slot.model,
            attempt,
            ok: true,
            latencyMs: Date.now() - started,
          });

          const trace: LlmCallTrace = {
            agentRole: opts.agentRole,
            purpose: opts.purpose,
            attempts,
            provider: slot.provider,
            model: slot.model,
            usedFallback: slot.provider !== this.cfg.defaultProvider,
          };

          this.logger.log(
            `LLM ok provider=${slot.provider} model=${slot.model} attempt=${attempt} fallback=${trace.usedFallback} purpose=${opts.purpose ?? '-'}`,
          );

          return { value, trace };
        } catch (err) {
          lastError = err;
          const { errorCode, errorMessage, retryable } =
            this.classifyError(err);
          attempts.push({
            provider: slot.provider,
            model: slot.model,
            attempt,
            ok: false,
            latencyMs: Date.now() - started,
            errorCode,
            errorMessage,
          });

          this.logger.warn(
            `LLM fail provider=${slot.provider} model=${slot.model} attempt=${attempt} code=${errorCode} retryable=${retryable}`,
          );

          if (!retryable || attempt >= maxTries) {
            break;
          }
          await this.sleep(300 * attempt);
        }
      }
    }

    const trace: LlmCallTrace = {
      agentRole: opts.agentRole,
      purpose: opts.purpose,
      attempts,
      provider: attempts.at(-1)?.provider ?? this.cfg.defaultProvider,
      model: attempts.at(-1)?.model ?? this.cfg.defaultModel,
      usedFallback: attempts.some(
        (a) => a.provider !== this.cfg.defaultProvider,
      ),
    };

    throw new LlmGatewayError(
      'LLM gateway exhausted primary + fallback',
      trace,
      lastError,
    );
  }

  private resolveModel(provider: LlmProvider, modelId: string): LanguageModel {
    if (provider === 'openai') {
      const openai = createOpenAI({ apiKey: this.cfg.openaiApiKey });
      return openai(modelId);
    }
    const google = createGoogleGenerativeAI({
      apiKey: this.cfg.googleApiKey,
    });
    return google(modelId);
  }

  private classifyError(err: unknown): {
    errorCode: string;
    errorMessage: string;
    retryable: boolean;
  } {
    const message =
      err instanceof Error ? err.message : String(err ?? 'unknown');
    const status =
      typeof err === 'object' &&
      err !== null &&
      'statusCode' in err &&
      typeof (err as { statusCode?: unknown }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : undefined;

    const lower = message.toLowerCase();
    const isTimeout =
      lower.includes('timeout') ||
      lower.includes('aborted') ||
      lower.includes('abort');
    const isRateLimit =
      status === 429 ||
      lower.includes('rate limit') ||
      lower.includes('429');
    const isServer =
      (status !== undefined && status >= 500) ||
      lower.includes('502') ||
      lower.includes('503') ||
      lower.includes('504');

    const retryable = isTimeout || isRateLimit || isServer;
    const errorCode = isRateLimit
      ? 'RATE_LIMIT'
      : isTimeout
        ? 'TIMEOUT'
        : isServer
          ? 'SERVER_ERROR'
          : status
            ? `HTTP_${status}`
            : 'LLM_ERROR';

    return { errorCode, errorMessage: message.slice(0, 500), retryable };
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
