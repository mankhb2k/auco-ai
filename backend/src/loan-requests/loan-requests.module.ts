import { Module } from '@nestjs/common';
import { PlanningModule } from '../planning/planning.module';
import { LoanRequestsController } from './loan-requests.controller';
import { LoanRequestsService } from './service/loan-requests.service';

@Module({
  imports: [PlanningModule],
  controllers: [LoanRequestsController],
  providers: [LoanRequestsService],
  exports: [LoanRequestsService],
})
export class LoanRequestsModule {}
