import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithActor } from '../common/demo-actor.middleware';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import {
  KnowledgeService,
  type CreateKnowledgeDraftDto,
  type UpdateKnowledgeDraftDto,
} from './service/knowledge.service';

@Controller('api/knowledge/documents')
@UseGuards(RequireLayerGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  @RequireLayer('manager', 'it_admin')
  list(
    @Req() req: RequestWithActor,
    @Query('domain') domain?: string,
    @Query('status') status?: string,
  ) {
    return this.knowledge.list({
      bankCode: req.actor!.bankCode,
      domain,
      status,
    });
  }

  @Get(':id')
  @RequireLayer('manager', 'it_admin')
  get(@Req() req: RequestWithActor, @Param('id') id: string) {
    return this.knowledge.get(id, req.actor!.bankCode);
  }

  @Post()
  @RequireLayer('manager')
  create(
    @Req() req: RequestWithActor,
    @Body() body: CreateKnowledgeDraftDto,
  ) {
    return this.knowledge.createDraft(body, req.actor!);
  }

  @Patch(':id')
  @RequireLayer('manager')
  update(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
    @Body() body: UpdateKnowledgeDraftDto,
  ) {
    return this.knowledge.updateDraft(id, body, req.actor!.bankCode);
  }

  @Post(':id/publish')
  @RequireLayer('manager')
  publish(@Req() req: RequestWithActor, @Param('id') id: string) {
    return this.knowledge.publish(id, req.actor!.bankCode, req.actor!.id);
  }
}
