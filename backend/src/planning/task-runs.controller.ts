import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { TaskRunsService } from './service/task-runs.service';

@Controller('api/task-runs')
export class TaskRunsController {
  constructor(private readonly taskRuns: TaskRunsService) {}

  @Post()
  async create(
    @Body()
    body: {
      goal?: string;
      bankCode?: string;
      employeeId?: string;
      async?: boolean;
    },
  ) {
    if (!body?.goal?.trim()) {
      throw new BadRequestException('goal is required');
    }
    return this.taskRuns.create({
      goal: body.goal,
      bankCode: body.bankCode,
      employeeId: body.employeeId,
      async: body.async === true,
    });
  }

  @Get()
  list(@Query('limit') limit?: string) {
    return this.taskRuns.list(limit ? Number(limit) : 20);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.taskRuns.getById(id);
  }
}
