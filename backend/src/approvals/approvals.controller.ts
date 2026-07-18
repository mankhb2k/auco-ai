import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import type { RequestWithActor } from '../common/demo-actor.middleware';
import { ApprovalsService } from './service/approvals.service';

@Controller('api/approvals')
@UseGuards(RequireLayerGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @RequireLayer('manager', 'employee')
  list(@Query('taskRunId') taskRunId?: string) {
    return this.approvals.listPending(taskRunId);
  }

  @Post(':stepId/approve')
  @RequireLayer('manager')
  approve(
    @Req() req: RequestWithActor,
    @Param('stepId') stepId: string,
    @Body() body?: { actorId?: string },
  ) {
    return this.approvals.approve(
      stepId,
      body?.actorId ?? req.actor?.id,
    );
  }

  @Post(':stepId/reject')
  @RequireLayer('manager')
  reject(
    @Req() req: RequestWithActor,
    @Param('stepId') stepId: string,
    @Body() body?: { reason?: string; actorId?: string },
  ) {
    return this.approvals.reject(stepId, {
      reason: body?.reason,
      actorId: body?.actorId ?? req.actor?.id,
    });
  }
}
