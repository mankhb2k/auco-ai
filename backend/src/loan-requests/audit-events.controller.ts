import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from '../audit/service/audit.service';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import type { RequestWithActor } from '../common/demo-actor.middleware';
import { LoanRequestsService } from './service/loan-requests.service';

/**
 * Đọc AuditEvent đã ghi sẵn (ghi ở LoanRequestsService/TaskRunsService/...).
 * Không phải SIEM — chỉ đủ để nhân viên/giám đốc xem "ai đã làm gì" trên
 * một hồ sơ, hoặc giám đốc xem theo actor.
 */
@Controller('api/audit-events')
@UseGuards(RequireLayerGuard)
export class AuditEventsController {
  constructor(
    private readonly audit: AuditService,
    private readonly loanRequests: LoanRequestsService,
  ) {}

  @Get()
  @RequireLayer('employee', 'manager')
  async list(
    @Req() req: RequestWithActor,
    @Query('resource') resource?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    const actor = req.actor!;
    const parsedLimit = limit ? Number(limit) : undefined;

    if (resource?.startsWith('LoanRequest:')) {
      const loanRequestId = resource.slice('LoanRequest:'.length);
      // Tái dùng scope-check sẵn có (assigned/branch) — throws nếu actor
      // không được xem hồ sơ này, nên cũng không được xem log của nó.
      await this.loanRequests.get(actor, loanRequestId);
      return this.audit.list({
        bankCode: actor.bankCode,
        resource,
        action,
        limit: parsedLimit,
      });
    }

    if (actor.accessLayer !== 'manager') {
      const targetActorId = actorId?.trim() || actor.id;
      if (targetActorId !== actor.id) {
        throw new ForbiddenException(
          'Employee chỉ được xem lịch sử của chính mình',
        );
      }
      return this.audit.list({
        bankCode: actor.bankCode,
        actorId: targetActorId,
        action,
        limit: parsedLimit,
      });
    }

    return this.audit.list({
      bankCode: actor.bankCode,
      actorId,
      action,
      limit: parsedLimit,
    });
  }
}
