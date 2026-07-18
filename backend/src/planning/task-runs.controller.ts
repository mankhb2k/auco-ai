import {
  BadRequestException,
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
import { TaskRunsService } from './service/task-runs.service';

@Controller('api/task-runs')
@UseGuards(RequireLayerGuard)
export class TaskRunsController {
  constructor(private readonly taskRuns: TaskRunsService) {}

  @Post()
  @RequireLayer('employee')
  async create(
    @Req() req: RequestWithActor,
    @Body()
    body: {
      goal?: string;
      bankCode?: string;
      employeeId?: string;
      async?: boolean;
      mode?: 'multi' | 'single';
      skipApprovalPropose?: boolean;
    },
  ) {
    if (!body?.goal?.trim()) {
      throw new BadRequestException('goal is required');
    }
    // role.md R2 — luôn gắn employeeId từ actor demo, không tin body
    const employeeId = req.actor?.id ?? body.employeeId;
    return this.taskRuns.create({
      goal: body.goal,
      bankCode: body.bankCode ?? req.actor?.bankCode,
      employeeId,
      async: body.async === true,
      mode: body.mode,
      skipApprovalPropose: body.skipApprovalPropose,
    });
  }

  @Get()
  @RequireLayer('employee', 'manager', 'it_admin')
  list(@Query('limit') limit?: string) {
    return this.taskRuns.list(limit ? Number(limit) : 20);
  }

  @Get(':id')
  @RequireLayer('employee', 'manager', 'it_admin')
  get(@Param('id') id: string) {
    return this.taskRuns.getById(id);
  }
}
