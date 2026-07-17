import { Module } from '@nestjs/common';
import { SpecialistService } from '../agents/specialist.service';
import { LlmModule } from '../llm/llm.module';
import { McpClientModule } from '../mcp-client/mcp-client.module';
import { OrchestratorService } from './orchestrator.service';
import { PlannerService } from './planner.service';
import { TaskRunsController } from './task-runs.controller';
import { TaskRunsService } from './task-runs.service';

@Module({
  imports: [LlmModule, McpClientModule],
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
