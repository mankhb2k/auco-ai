import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { isRagDomain } from './indexes';
import { RagService } from './service/rag.service';

@Controller('api/rag')
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Get('status')
  status() {
    return this.rag.status();
  }

  @Post('ingest')
  ingest(@Body() body?: { bankCode?: string }) {
    return this.rag.ingestAll(body?.bankCode);
  }

  @Post('search')
  async search(
    @Body()
    body: {
      domain?: string;
      query?: string;
      bankCode?: string;
      limit?: number;
      includeSuperseded?: boolean;
    },
  ) {
    if (!body?.query?.trim()) {
      throw new BadRequestException('query is required');
    }
    if (!body.domain || !isRagDomain(body.domain)) {
      throw new BadRequestException(
        'domain must be one of credit|legal|product|ops',
      );
    }
    return this.rag.search({
      domain: body.domain,
      query: body.query,
      bankCode: body.bankCode,
      limit: body.limit,
      includeSuperseded: body.includeSuperseded,
    });
  }

  @Get('search')
  async searchGet(
    @Query('domain') domain?: string,
    @Query('q') q?: string,
    @Query('bankCode') bankCode?: string,
  ) {
    if (!q?.trim()) throw new BadRequestException('q is required');
    if (!domain || !isRagDomain(domain)) {
      throw new BadRequestException(
        'domain must be one of credit|legal|product|ops',
      );
    }
    return this.rag.search({ domain, query: q, bankCode });
  }
}
