import { HealthService } from './health.service';
import type { LlmGatewayService } from '../../llm/llm.gateway';
import type { PrismaService } from '../../prisma/service/prisma.service';
import type { RedisService } from '../../redis/service/redis.service';

describe('HealthService', () => {
  const prisma = { ping: jest.fn() } as unknown as PrismaService;
  const redis = {
    isConfigured: false,
    ping: jest.fn(),
  } as unknown as RedisService;
  const llm = {
    isPrimaryConfigured: true,
    isFallbackConfigured: false,
  } as unknown as LlmGatewayService;

  let service: HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    (redis as { isConfigured: boolean }).isConfigured = false;
    service = new HealthService(prisma, redis, llm);
  });

  it('returns ok when database is up and redis skipped', async () => {
    (prisma.ping as jest.Mock).mockResolvedValue(true);
    const result = await service.check();
    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('up');
    expect(result.checks.redis).toBe('skipped');
  });

  it('returns error when database is down', async () => {
    (prisma.ping as jest.Mock).mockRejectedValue(new Error('db down'));
    const result = await service.check();
    expect(result.status).toBe('error');
    expect(result.checks.database).toBe('down');
  });

  it('returns degraded when redis is configured but down', async () => {
    (prisma.ping as jest.Mock).mockResolvedValue(true);
    (redis as { isConfigured: boolean }).isConfigured = true;
    (redis.ping as jest.Mock).mockResolvedValue(false);
    const result = await service.check();
    expect(result.status).toBe('degraded');
    expect(result.checks.redis).toBe('down');
  });
});
