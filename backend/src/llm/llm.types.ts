export type LlmProvider = 'openai' | 'google' | 'onprem';

export type LlmAttemptTrace = {
  provider: LlmProvider;
  model: string;
  attempt: number;
  errorCode?: string;
  errorMessage?: string;
  latencyMs?: number;
  ok: boolean;
};

export type LlmCallTrace = {
  agentRole?: string;
  purpose?: string;
  /** §5.4 — tier gateway đã chọn theo purpose (small/mid/large). */
  tier?: string;
  attempts: LlmAttemptTrace[];
  provider: LlmProvider;
  model: string;
  usedFallback: boolean;
};

export type LlmTextResult = {
  text: string;
  trace: LlmCallTrace;
};

export type LlmObjectResult<T> = {
  object: T;
  trace: LlmCallTrace;
};

export class LlmGatewayError extends Error {
  constructor(
    message: string,
    readonly trace: LlmCallTrace,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LlmGatewayError';
  }
}
