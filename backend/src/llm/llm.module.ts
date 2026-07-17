import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { llmConfig } from './llm.config';
import { LlmController } from './llm.controller';
import { LlmGatewayService } from './llm.gateway';

@Module({
  imports: [ConfigModule.forFeature(llmConfig)],
  controllers: [LlmController],
  providers: [LlmGatewayService],
  exports: [LlmGatewayService],
})
export class LlmModule {}
