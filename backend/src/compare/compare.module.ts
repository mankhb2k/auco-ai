import { Module } from '@nestjs/common';
import { PlanningModule } from '../planning/planning.module';
import { CompareController } from './compare.controller';
import { CompareService } from './service/compare.service';

@Module({
  imports: [PlanningModule],
  controllers: [CompareController],
  providers: [CompareService],
})
export class CompareModule {}
