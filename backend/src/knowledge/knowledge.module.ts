import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { BankHqController } from './bank-hq.controller';
import { KnowledgeController } from './knowledge.controller';
import { BankHqService } from './service/bank-hq.service';
import { KnowledgeSyncService } from './service/knowledge-sync.service';
import { KnowledgeService } from './service/knowledge.service';

@Module({
  imports: [RagModule],
  controllers: [KnowledgeController, BankHqController],
  providers: [KnowledgeService, BankHqService, KnowledgeSyncService],
  exports: [KnowledgeService, KnowledgeSyncService],
})
export class KnowledgeModule {}
