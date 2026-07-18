import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  it('is not configured when REDIS_URL is missing', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new RedisService(config);
    expect(service.isConfigured).toBe(false);
    expect(service.getClient()).toBeNull();
  });

  it('ping returns false when client is not configured', async () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new RedisService(config);
    await expect(service.ping()).resolves.toBe(false);
  });

  it('onModuleDestroy is safe when not configured', async () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new RedisService(config);
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
