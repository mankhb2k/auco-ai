import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings/service/embeddings.service';
import { IngestService } from './service/ingest.service';
import { RagService } from './service/rag.service';
import { RetrieveService } from './service/retrieve.service';

@Module({
  providers: [
    EmbeddingsService,
    IngestService,
    RetrieveService,
    RagService,
  ],
  exports: [RagService, IngestService, RetrieveService],
})
export class RagModule {}
