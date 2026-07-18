import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { RequestWithActor } from '../common/demo-actor.middleware';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import { AuditService } from './service/audit.service';

@Controller('api/audit')
@UseGuards(RequireLayerGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequireLayer('manager', 'it_admin')
  list(
    @Req() req: RequestWithActor,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    return this.audit.list({
      bankCode: req.actor!.bankCode,
      limit: limit ? Number(limit) : 50,
      action,
    });
  }
}
