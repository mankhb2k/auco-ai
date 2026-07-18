import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import { BankHqService } from './service/bank-hq.service';

/** API giả lập của hội sở ngân hàng — nguồn tri thức chuẩn hóa (read-only). */
@Controller('api/bank-hq')
@UseGuards(RequireLayerGuard)
export class BankHqController {
  constructor(private readonly bankHq: BankHqService) {}

  @Get('knowledge')
  @RequireLayer('employee', 'manager', 'it_admin')
  knowledge() {
    return this.bankHq.fetchKnowledge();
  }
}
