import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { LlmModule } from './llm/llm.module';
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
    // Phase 4+: PlanningModule, AgentsModule, McpClientModule,
    // RagModule, ApprovalsModule, AutomationsModule, RealtimeModule
  ],
})
export class AppModule {}
