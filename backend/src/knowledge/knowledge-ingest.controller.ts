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
import type { RequestWithActor } from '../common/demo-actor.middleware';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import type {
  CreateIngestJobDto,
  ReviewProposalDto,
} from './schemas/change-proposal.schema';
import { KnowledgeIngestService } from './service/knowledge-ingest.service';

@Controller('api/knowledge/ingest')
@UseGuards(RequireLayerGuard)
export class KnowledgeIngestController {
  constructor(private readonly ingest: KnowledgeIngestService) {}

  @Post('jobs')
  @RequireLayer('manager')
  createJob(@Req() req: RequestWithActor, @Body() body: CreateIngestJobDto) {
    return this.ingest.createJob(body, req.actor!);
  }

  @Get('jobs')
  @RequireLayer('manager')
  listJobs(
    @Req() req: RequestWithActor,
    @Query('domain') domain?: string,
    @Query('status') status?: string,
  ) {
    return this.ingest.listJobs({
      bankCode: req.actor!.bankCode,
      domain,
      status,
    });
  }

  @Get('jobs/:id')
  @RequireLayer('manager')
  getJob(@Req() req: RequestWithActor, @Param('id') id: string) {
    return this.ingest.getJob(id, req.actor!.bankCode);
  }

  @Get('proposals')
  @RequireLayer('manager')
  listProposals(
    @Req() req: RequestWithActor,
    @Query('domain') domain?: string,
    @Query('status') status?: string,
  ) {
    return this.ingest.listProposals({
      bankCode: req.actor!.bankCode,
      domain,
      status,
    });
  }

  @Get('proposals/:id')
  @RequireLayer('manager')
  getProposal(@Req() req: RequestWithActor, @Param('id') id: string) {
    return this.ingest.getProposal(id, req.actor!.bankCode);
  }

  @Post('proposals/:id/approve')
  @RequireLayer('manager')
  approve(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
    @Body() body?: ReviewProposalDto,
  ) {
    return this.ingest.approve(id, req.actor!, body);
  }

  @Post('proposals/:id/reject')
  @RequireLayer('manager')
  reject(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
    @Body() body?: ReviewProposalDto,
  ) {
    return this.ingest.reject(id, req.actor!, body);
  }
}
