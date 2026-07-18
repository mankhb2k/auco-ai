import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithActor } from '../common/demo-actor.middleware';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import { KnowledgeService } from './service/knowledge.service';
import { KnowledgeSyncService } from './service/knowledge-sync.service';

@Controller('api/knowledge/documents')
@UseGuards(RequireLayerGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly knowledgeSync: KnowledgeSyncService,
  ) {}

  @Get()
  @RequireLayer('employee', 'manager', 'it_admin')
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

  /** Đồng bộ tri thức chuẩn hóa từ API hội sở (mock) và re-index RAG. */
  @Post('sync')
  @RequireLayer('employee', 'manager', 'it_admin')
  sync(@Req() req: RequestWithActor) {
    return this.knowledgeSync.syncFromHq(req.actor!);
  }

  @Get(':id')
  @RequireLayer('employee', 'manager', 'it_admin')
  get(@Req() req: RequestWithActor, @Param('id') id: string) {
    return this.knowledge.get(id, req.actor!.bankCode);
  }
}
