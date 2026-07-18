import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings/embeddings.service';
import { IngestService } from './ingest.service';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RetrieveService } from './retrieve.service';

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
