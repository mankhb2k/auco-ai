import { registerAs } from '@nestjs/config';
import type { ModelTier } from './llm.routing';

export type LlmPrimaryProvider = 'openai' | 'onprem';

export type LlmEnvConfig = {
  openaiApiKey?: string;
  googleApiKey?: string;
  /**
   * Primary provider của platform:
   * - 'openai'  — demo/cloud (mặc định)
   * - 'onprem'  — endpoint OpenAI-compatible trong perimeter bank (vLLM/TGI/Ollama)
   */
  primaryProvider: LlmPrimaryProvider;
  defaultModel: string;
  /** §5.4 tier routing — model theo tier của primary provider. */
  tierModels: Record<ModelTier, string>;
  fallbackProvider: 'google';
  fallbackModel: string;
  /** On-prem (OpenAI-compatible) — chỉ dùng khi primaryProvider='onprem'. */
  onprem: {
    baseUrl?: string;
    apiKey?: string;
  };
  maxRetriesPrimary: number;
  requestTimeoutMs: number;
  smokeEnabled: boolean;
};

export const llmConfig = registerAs('llm', (): LlmEnvConfig => {
  const defaultModel = process.env.DEFAULT_LLM_MODEL?.trim() || 'gpt-4o';
  const primaryProvider: LlmPrimaryProvider =
    process.env.LLM_PRIMARY_PROVIDER?.trim() === 'onprem' ? 'onprem' : 'openai';

  // Tier models: env override từng tier; thiếu thì rơi về defaultModel
  // (một model cho mọi tier = hành vi cũ, không phá demo).
  const tierModels: Record<ModelTier, string> = {
    small: process.env.LLM_MODEL_SMALL?.trim() || defaultModel,
    mid: process.env.LLM_MODEL_MID?.trim() || defaultModel,
    large: process.env.LLM_MODEL_LARGE?.trim() || defaultModel,
  };

  return {
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    // AI SDK Google provider reads GOOGLE_GENERATIVE_AI_API_KEY;
    // we also accept GEMINI_API_KEY as alias.
    googleApiKey:
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      undefined,
    primaryProvider,
    defaultModel,
    tierModels,
    fallbackProvider: 'google',
    fallbackModel:
      process.env.FALLBACK_LLM_MODEL?.trim() || 'gemini-2.0-flash',
    onprem: {
      baseUrl: process.env.ONPREM_LLM_BASE_URL?.trim() || undefined,
      apiKey: process.env.ONPREM_LLM_API_KEY?.trim() || undefined,
    },
    maxRetriesPrimary: Number(process.env.LLM_PRIMARY_RETRIES ?? 2),
    requestTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 60_000),
    smokeEnabled:
      process.env.LLM_SMOKE_ENABLED === 'true' ||
      process.env.NODE_ENV !== 'production',
  };
});
