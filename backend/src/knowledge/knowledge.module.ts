import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './service/knowledge.service';

@Module({
  imports: [RagModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
