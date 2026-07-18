import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActorsModule } from './actors/actors.module';
import { AuditModule } from './audit/audit.module';
import { CommonModule } from './common/common.module';
import { DemoActorMiddleware } from './common/demo-actor.middleware';
import { HealthModule } from './health/health.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LlmModule } from './llm/llm.module';
import { LoanRequestsModule } from './loan-requests/loan-requests.module';
import { McpClientModule } from './mcp-client/mcp-client.module';
import { PlanningModule } from './planning/planning.module';
import { PrismaModule } from './prisma/prisma.module';
import { RagModule } from './rag/rag.module';
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
    AuditModule,
    HealthModule,
    LlmModule,
    McpClientModule,
    RagModule,
    PlanningModule,
    ActorsModule,
    KnowledgeModule,
    LoanRequestsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DemoActorMiddleware).forRoutes('api/*path');
  }
}
