import { Module } from '@nestjs/common';
import { SpecialistStubService } from '../agents/specialist-stub.service';
import { LlmModule } from '../llm/llm.module';
import { OrchestratorService } from './orchestrator.service';
import { PlannerService } from './planner.service';
import { TaskRunsController } from './task-runs.controller';
import { TaskRunsService } from './task-runs.service';

@Module({
  imports: [LlmModule],
  controllers: [TaskRunsController],
  providers: [
    PlannerService,
    OrchestratorService,
    TaskRunsService,
    SpecialistStubService,
  ],
  exports: [TaskRunsService, PlannerService, OrchestratorService],
})
export class PlanningModule {}
