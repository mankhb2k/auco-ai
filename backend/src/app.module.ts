import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActorsModule } from './actors/actors.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { CommonModule } from './common/common.module';
import { DemoActorMiddleware } from './common/demo-actor.middleware';
import { AutomationsModule } from './automations/automations.module';
import { CompareModule } from './compare/compare.module';
import { HealthModule } from './health/health.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
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
    CommonModule,
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
    CompareModule,
    ActorsModule,
    KnowledgeModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // role.md Phase R1 — gắn actor demo từ X-Demo-Employee-Id cho mọi route API
    consumer.apply(DemoActorMiddleware).forRoutes('api/*path');
  }
}
