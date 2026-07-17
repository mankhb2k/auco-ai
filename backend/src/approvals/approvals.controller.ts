import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';

@Controller('api/approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  list(@Query('taskRunId') taskRunId?: string) {
    return this.approvals.listPending(taskRunId);
  }

  @Post(':stepId/approve')
  approve(
    @Param('stepId') stepId: string,
    @Body() body?: { actorId?: string },
  ) {
    return this.approvals.approve(stepId, body?.actorId);
  }

  @Post(':stepId/reject')
  reject(
    @Param('stepId') stepId: string,
    @Body() body?: { reason?: string; actorId?: string },
  ) {
    return this.approvals.reject(stepId, body);
  }
}
