import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { LlmEnvConfig } from './llm.config';
import { LlmGatewayService } from './llm.gateway';
import { LlmGatewayError } from './llm.types';

const SmokeSchema = z.object({
  ok: z.boolean(),
  bankCode: z.string(),
  summary: z.string().min(1),
});

@Controller('api/llm')
export class LlmController {
  constructor(
    private readonly llm: LlmGatewayService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  status() {
    return this.llm.getStatus();
  }

  /** Tiny generateObject smoke — disabled in production unless LLM_SMOKE_ENABLED=true */
  @Post('smoke')
  async smoke() {
    const cfg = this.config.getOrThrow<LlmEnvConfig>('llm');
    if (!cfg.smokeEnabled) {
      throw new ServiceUnavailableException(
        'LLM smoke disabled (set LLM_SMOKE_ENABLED=true)',
      );
    }
    if (!this.llm.isPrimaryConfigured && !this.llm.isFallbackConfigured) {
      throw new ServiceUnavailableException(
        'No LLM API key configured (OPENAI_API_KEY / GEMINI_API_KEY)',
      );
    }

    try {
      const result = await this.llm.generateObject({
        agentRole: 'planner',
        purpose: 'smoke',
        schema: SmokeSchema,
        system:
          'You are a health-check helper for a Vietnamese banking AI demo. Reply only with structured fields.',
        prompt:
          'Confirm the demo bank is SHB and return ok=true with a one-sentence Vietnamese summary.',
      });

      return {
        status: 'ok',
        object: result.object,
        trace: result.trace,
      };
    } catch (err) {
      if (err instanceof LlmGatewayError) {
        throw new HttpException(
          {
            status: 'error',
            message: err.message,
            trace: err.trace,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw err;
    }
  }
}
