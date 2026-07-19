import { Module } from '@nestjs/common';
import { PlanningModule } from '../planning/planning.module';
import { AuditEventsController } from './audit-events.controller';
import { LoanRequestsController } from './loan-requests.controller';
import { LoanRequestsService } from './service/loan-requests.service';

@Module({
  imports: [PlanningModule],
  controllers: [LoanRequestsController, AuditEventsController],
  providers: [LoanRequestsService],
  exports: [LoanRequestsService],
})
export class LoanRequestsModule {}
