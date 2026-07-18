import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AutomationsService } from './service/automations.service';

@Controller('api/automations')
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  list(@Query('bankCode') bankCode?: string) {
    return this.automations.list(bankCode?.trim() || 'SHB');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.automations.get(id);
  }

  @Get(':id/runs')
  runs(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.automations.listRuns(id, limit ? Number(limit) : 20);
  }

  @Patch(':id')
  patch(
    @Param('id') id: string,
    @Body()
    body: {
      enabled?: boolean;
      cronExpr?: string;
      status?: string;
      name?: string;
      description?: string;
    },
  ) {
    return this.automations.patch(id, body);
  }

  @Post(':id/run-now')
  runNow(
    @Param('id') id: string,
    @Body() body?: { actorId?: string },
  ) {
    return this.automations.runNow(id, body?.actorId);
  }
}
