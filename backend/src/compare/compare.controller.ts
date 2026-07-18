import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { CompareService } from './service/compare.service';

@Controller('api/compare')
export class CompareController {
  constructor(private readonly compare: CompareService) {}

  @Post()
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
