import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings/service/embeddings.service';
import { IngestService } from './service/ingest.service';
import { RagController } from './rag.controller';
import { RagService } from './service/rag.service';
import { RetrieveService } from './service/retrieve.service';

@Module({
  controllers: [RagController],
  providers: [
    EmbeddingsService,
    IngestService,
    RetrieveService,
    RagService,
  ],
  exports: [RagService, IngestService, RetrieveService],
})
export class RagModule {}
