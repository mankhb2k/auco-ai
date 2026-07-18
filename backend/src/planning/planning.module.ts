import { Module } from '@nestjs/common';
import { ActorsModule } from '../actors/actors.module';
import { SpecialistService } from '../agents/service/specialist.service';
import { LlmModule } from '../llm/llm.module';
import { McpClientModule } from '../mcp-client/mcp-client.module';
import { RagModule } from '../rag/rag.module';
import { OrchestratorService } from './service/orchestrator.service';
import { PlannerService } from './service/planner.service';
import { TaskRunsController } from './task-runs.controller';
import { TaskRunsService } from './service/task-runs.service';

@Module({
  imports: [ActorsModule, LlmModule, McpClientModule, RagModule],
  controllers: [TaskRunsController],
  providers: [
    PlannerService,
    OrchestratorService,
    TaskRunsService,
    SpecialistService,
  ],
  exports: [TaskRunsService, PlannerService, OrchestratorService],
})
export class PlanningModule {}
