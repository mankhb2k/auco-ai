import { Module } from '@nestjs/common';
import { McpClientModule } from '../mcp-client/mcp-client.module';
import { PlanningModule } from '../planning/planning.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [PlanningModule, McpClientModule, RealtimeModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
