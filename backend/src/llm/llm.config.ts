import { registerAs } from '@nestjs/config';

export type LlmEnvConfig = {
  openaiApiKey?: string;
  googleApiKey?: string;
  defaultProvider: 'openai';
  defaultModel: string;
  fallbackProvider: 'google';
  fallbackModel: string;
  maxRetriesPrimary: number;
  requestTimeoutMs: number;
  smokeEnabled: boolean;
};

export const llmConfig = registerAs(
  'llm',
  (): LlmEnvConfig => ({
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    // AI SDK Google provider reads GOOGLE_GENERATIVE_AI_API_KEY;
    // we also accept GEMINI_API_KEY as alias.
    googleApiKey:
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      undefined,
    defaultProvider: 'openai',
    defaultModel: process.env.DEFAULT_LLM_MODEL?.trim() || 'gpt-4o',
    fallbackProvider: 'google',
    fallbackModel:
      process.env.FALLBACK_LLM_MODEL?.trim() || 'gemini-2.0-flash',
    maxRetriesPrimary: Number(process.env.LLM_PRIMARY_RETRIES ?? 2),
    requestTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 60_000),
    smokeEnabled:
      process.env.LLM_SMOKE_ENABLED === 'true' ||
      process.env.NODE_ENV !== 'production',
  }),
);
