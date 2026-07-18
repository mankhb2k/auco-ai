import { ConfigService } from '@nestjs/config';
import { EmbeddingsService } from './embeddings.service';

describe('EmbeddingsService', () => {
  function createService(env: Record<string, string | undefined> = {}) {
    const config = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
    return new EmbeddingsService(config);
  }

  it('reports none when no API keys', () => {
    const service = createService();
    expect(service.isConfigured).toBe(false);
    expect(service.provider).toBe('none');
    expect(service.dimensions).toBe(1536);
  });

  it('prefers openai when OPENAI_API_KEY is set', () => {
    const service = createService({ OPENAI_API_KEY: 'sk-test' });
    expect(service.isConfigured).toBe(true);
    expect(service.provider).toBe('openai');
  });

  it('embedOne returns null when not configured', async () => {
    await expect(createService().embedOne('hello')).resolves.toBeNull();
  });

  it('embedMany returns null vectors when not configured', async () => {
    await expect(createService().embedMany(['a', 'b'])).resolves.toEqual([
      null,
      null,
    ]);
  });
});
