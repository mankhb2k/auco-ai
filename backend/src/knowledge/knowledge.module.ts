import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RagModule } from '../rag/rag.module';
import { KnowledgeIngestController } from './knowledge-ingest.controller';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeCuratorService } from './service/knowledge-curator.service';
import { KnowledgeIngestService } from './service/knowledge-ingest.service';
import { KnowledgeService } from './service/knowledge.service';

@Module({
  imports: [RagModule, LlmModule],
  controllers: [KnowledgeController, KnowledgeIngestController],
  providers: [
    KnowledgeService,
    KnowledgeCuratorService,
    KnowledgeIngestService,
  ],
  exports: [KnowledgeService, KnowledgeIngestService, KnowledgeCuratorService],
})
export class KnowledgeModule {}
