import type { ConfigService } from '@nestjs/config';
import type { LlmEnvConfig } from './llm.config';
import { LlmGatewayService } from './llm.gateway';
import { DEFAULT_TIER, tierForPurpose } from './llm.routing';

function makeConfig(overrides: Partial<LlmEnvConfig> = {}): ConfigService {
  const cfg: LlmEnvConfig = {
    openaiApiKey: 'sk-test',
    googleApiKey: undefined,
    primaryProvider: 'openai',
    defaultModel: 'gpt-4o',
    tierModels: {
      small: 'gpt-4o-mini',
      mid: 'gpt-4o',
      large: 'gpt-4.1',
    },
    fallbackProvider: 'google',
    fallbackModel: 'gemini-2.0-flash',
    onprem: {},
    maxRetriesPrimary: 1,
    requestTimeoutMs: 5_000,
    smokeEnabled: true,
    ...overrides,
  };
  return {
    getOrThrow: () => cfg,
  } as unknown as ConfigService;
}

describe('llm.routing — purpose → tier', () => {
  it('routes planning/synthesis to large', () => {
    expect(tierForPurpose('task_plan')).toBe('large');
    expect(tierForPurpose('synthesize')).toBe('large');
  });

  it('routes specialist and knowledge curation to mid', () => {
    expect(tierForPurpose('specialist')).toBe('mid');
    expect(tierForPurpose('knowledge_ingest_propose')).toBe('mid');
  });

  it('routes extraction/classification/smoke to small', () => {
    expect(tierForPurpose('extract')).toBe('small');
    expect(tierForPurpose('classify')).toBe('small');
    expect(tierForPurpose('smoke')).toBe('small');
  });

  it('falls back to DEFAULT_TIER for unknown or missing purpose', () => {
    expect(tierForPurpose('something_new')).toBe(DEFAULT_TIER);
    expect(tierForPurpose(undefined)).toBe(DEFAULT_TIER);
  });
});

describe('LlmGatewayService — tier + on-prem config', () => {
  it('resolveTier prefers explicit tier over purpose', () => {
    const svc = new LlmGatewayService(makeConfig());
    expect(svc.resolveTier({ purpose: 'task_plan' })).toBe('large');
    expect(svc.resolveTier({ purpose: 'task_plan', tier: 'small' })).toBe(
      'small',
    );
  });

  it('getStatus exposes tier models and purpose routing', () => {
    const svc = new LlmGatewayService(makeConfig());
    const status = svc.getStatus();
    expect(status.tiers).toEqual({
      small: 'gpt-4o-mini',
      mid: 'gpt-4o',
      large: 'gpt-4.1',
    });
    expect(status.purposeRouting.task_plan).toBe('large');
    expect(status.primary.provider).toBe('openai');
    expect(status.primary.configured).toBe(true);
  });

  it('onprem primary requires ONPREM_LLM_BASE_URL to be configured', () => {
    const missing = new LlmGatewayService(
      makeConfig({ primaryProvider: 'onprem', openaiApiKey: undefined }),
    );
    expect(missing.isPrimaryConfigured).toBe(false);

    const configured = new LlmGatewayService(
      makeConfig({
        primaryProvider: 'onprem',
        openaiApiKey: undefined,
        onprem: { baseUrl: 'http://vllm.bank.local/v1' },
      }),
    );
    expect(configured.isPrimaryConfigured).toBe(true);
    expect(configured.getStatus().primary).toMatchObject({
      provider: 'onprem',
      configured: true,
      baseUrl: 'http://vllm.bank.local/v1',
    });
  });
});
