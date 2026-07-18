import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import { CompareService } from './service/compare.service';

@Controller('api/compare')
@UseGuards(RequireLayerGuard)
export class CompareController {
  constructor(private readonly compare: CompareService) {}

  @Post()
  @RequireLayer('employee')
  async create(
    @Body()
    body: {
      goal?: string;
      bankCode?: string;
    },
  ) {
    if (!body?.goal?.trim()) {
      throw new BadRequestException('goal is required');
    }
    return this.compare.runCompare({
      goal: body.goal,
      bankCode: body.bankCode,
    });
  }
}
