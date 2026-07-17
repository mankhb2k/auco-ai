import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { LlmModule } from './llm/llm.module';
import { McpClientModule } from './mcp-client/mcp-client.module';
import { PlanningModule } from './planning/planning.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    LlmModule,
    McpClientModule,
    PlanningModule,
    // Phase 6+: RagModule, ApprovalsModule, AutomationsModule, RealtimeModule
  ],
})
export class AppModule {}
