import { Controller, Get, Query } from '@nestjs/common';
import { ActorsService } from './service/actors.service';

@Controller('api/actors')
export class ActorsController {
  constructor(private readonly actors: ActorsService) {}

  /** FE role switcher — danh sách employee seed. */
  @Get()
  list(@Query('bankCode') bankCode?: string) {
    return this.actors.list(bankCode?.trim() || 'SHB');
  }
}
