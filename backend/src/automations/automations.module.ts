import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AutomationRunnerService } from './service/automation-runner.service';
import { AutomationSchedulerService } from './service/automation-scheduler.service';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './service/automations.service';

@Module({
  imports: [LlmModule, RealtimeModule],
  controllers: [AutomationsController],
  providers: [
    AutomationsService,
    AutomationRunnerService,
    AutomationSchedulerService,
  ],
  exports: [AutomationsService, AutomationRunnerService],
})
export class AutomationsModule {}
