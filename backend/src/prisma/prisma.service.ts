import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    await this.ensurePgvector();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }

  /** Enable pgvector for RAG (Phase 7). Safe to re-run. */
  private async ensurePgvector() {
    try {
      await this.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
    } catch {
      // Railway managed Postgres may need extension enabled in dashboard first
    }
  }

  async ping(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }
}
