import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { llmConfig } from './llm.config';
import { LlmGatewayService } from './llm.gateway';

@Module({
  imports: [ConfigModule.forFeature(llmConfig)],
  providers: [LlmGatewayService],
  exports: [LlmGatewayService],
})
export class LlmModule {}
