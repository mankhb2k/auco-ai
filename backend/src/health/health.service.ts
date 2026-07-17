import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type HealthStatus = {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down' | 'skipped';
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
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
      checks: { database, redis },
    };
  }
}
