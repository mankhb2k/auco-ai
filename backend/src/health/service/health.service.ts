import { Injectable } from '@nestjs/common';
import { LlmGatewayService } from '../../llm/llm.gateway';
import { PrismaService } from '../../prisma/service/prisma.service';
import { RedisService } from '../../redis/service/redis.service';

export type HealthStatus = {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down' | 'skipped';
    llm: {
      primary: 'configured' | 'missing';
      fallback: 'configured' | 'missing';
    };
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly llm: LlmGatewayService,
  ) {}

  async check(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    let database: 'up' | 'down' = 'down';
    let redis: 'up' | 'down' | 'skipped' = 'skipped';

    try {
      await this.prisma.ping();
      database = 'up';
    } catch {
      database = 'down';
    }

    if (this.redis.isConfigured) {
      try {
        redis = (await this.redis.ping()) ? 'up' : 'down';
      } catch {
        redis = 'down';
      }
    }

    const llm = {
      primary: this.llm.isPrimaryConfigured
        ? ('configured' as const)
        : ('missing' as const),
      fallback: this.llm.isFallbackConfigured
        ? ('configured' as const)
        : ('missing' as const),
    };

    const status =
      database === 'down'
        ? 'error'
        : redis === 'down'
          ? 'degraded'
          : 'ok';

    return {
      status,
      service: 'auco-backend',
      timestamp,
      checks: { database, redis, llm },
    };
  }
}
