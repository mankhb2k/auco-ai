import type { TokenUsage, UsageEvent, RunUsageSummary } from "@/lib/types/domain";

/** Mock pricing — gpt-4.1-class (USD / 1M tokens). */
const PRICE = {
  model: "gpt-4.1-mini (mock)",
  inputPer1M: 0.4,
  outputPer1M: 1.6,
};

export function emptyUsageSummary(): RunUsageSummary {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    wallClockMs: 0,
    events: [],
  };
}

export function makeUsage(partial: {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  model?: string;
}): TokenUsage {
  const promptTokens = partial.promptTokens;
  const completionTokens = partial.completionTokens;
  const totalTokens = promptTokens + completionTokens;
  const costUsd =
    (promptTokens / 1_000_000) * PRICE.inputPer1M +
    (completionTokens / 1_000_000) * PRICE.outputPer1M;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd: Number(costUsd.toFixed(6)),
    model: partial.model ?? PRICE.model,
    latencyMs: partial.latencyMs,
  };
}

export function mergeUsage(
  summary: RunUsageSummary,
  event: Omit<UsageEvent, "id" | "at"> & { id?: string; at?: string },
): RunUsageSummary {
  const full: UsageEvent = {
    id: event.id ?? `ue-${Math.random().toString(36).slice(2, 9)}`,
    at: event.at ?? new Date().toISOString(),
    kind: event.kind,
    agentRole: event.agentRole,
    stepId: event.stepId,
    label: event.label,
    usage: event.usage,
  };
  return {
    promptTokens: summary.promptTokens + full.usage.promptTokens,
    completionTokens: summary.completionTokens + full.usage.completionTokens,
    totalTokens: summary.totalTokens + full.usage.totalTokens,
    costUsd: Number((summary.costUsd + full.usage.costUsd).toFixed(6)),
    wallClockMs: summary.wallClockMs,
    events: [...summary.events, full],
  };
}

export function formatUsd(n: number) {
  return `$${n.toFixed(4)}`;
}

export function formatTokens(n: number) {
  return n.toLocaleString("en-US");
}
