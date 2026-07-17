import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApprovalsModule } from './approvals/approvals.module';
import { AutomationsModule } from './automations/automations.module';
import { HealthModule } from './health/health.module';
import { LlmModule } from './llm/llm.module';
import { McpClientModule } from './mcp-client/mcp-client.module';
import { PlanningModule } from './planning/planning.module';
import { PrismaModule } from './prisma/prisma.module';
import { RagModule } from './rag/rag.module';
import { RealtimeModule } from './realtime/realtime.module';
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
    RagModule,
    RealtimeModule,
    PlanningModule,
    ApprovalsModule,
    AutomationsModule,
  ],
})
export class AppModule {}
