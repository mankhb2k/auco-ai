import { z } from "zod";

export const wsEventTypeSchema = z.enum([
  "message.chunk",
  "message.done",
  "tool.started",
  "tool.finished",
  "tool.error",
  "approval.updated",
  "job.status",
  "ping",
  "pong",
]);

export type WsEventType = z.infer<typeof wsEventTypeSchema>;

export const messageChunkPayloadSchema = z.object({
  messageId: z.string(),
  delta: z.string(),
});

export type MessageChunkPayload = z.infer<typeof messageChunkPayloadSchema>;

export const messageDonePayloadSchema = z.object({
  messageId: z.string(),
  streamingId: z.string(),
  content: z.string(),
});

export type MessageDonePayload = z.infer<typeof messageDonePayloadSchema>;

export const toolStartedPayloadSchema = z.object({
  runId: z.string(),
  toolCallId: z.string(),
  name: z.string(),
  label: z.string().optional(),
  inputSummary: z.string().optional(),
});

export type ToolStartedPayload = z.infer<typeof toolStartedPayloadSchema>;

export const toolFinishedPayloadSchema = z.object({
  runId: z.string(),
  toolCallId: z.string(),
  name: z.string(),
  ok: z.boolean(),
  detail: z.string().optional(),
});

export type ToolFinishedPayload = z.infer<typeof toolFinishedPayloadSchema>;

export const toolErrorPayloadSchema = z.object({
  runId: z.string(),
  toolCallId: z.string(),
  name: z.string(),
  message: z.string(),
});

export type ToolErrorPayload = z.infer<typeof toolErrorPayloadSchema>;

export const wsEventEnvelopeSchema = z.object({
  type: wsEventTypeSchema,
  conversationId: z.string(),
  timestamp: z.string(),
  payload: z.unknown(),
});

export type WsEventEnvelope = z.infer<typeof wsEventEnvelopeSchema>;

export function createWsEvent<T>(
  type: WsEventType,
  conversationId: string,
  payload: T,
): WsEventEnvelope {
  return {
    type,
    conversationId,
    timestamp: new Date().toISOString(),
    payload,
  };
}
