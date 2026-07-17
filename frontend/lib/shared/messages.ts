import { z } from "zod";

export const messageSenderTypeSchema = z.enum(["user", "agent"]);

export type MessageSenderType = z.infer<typeof messageSenderTypeSchema>;

export const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const messageResponseSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderType: messageSenderTypeSchema,
  agentId: z.string().nullable(),
  content: z.string(),
  createdAt: z.string(),
});

export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const sendMessageResponseSchema = z.object({
  userMessage: messageResponseSchema,
  /** Present when reply was generated inline (non-stream / no WS clients). */
  assistantMessage: messageResponseSchema.optional(),
  /** True when assistant reply is delivered via WebSocket stream. */
  streaming: z.boolean().optional(),
});

export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;

export const messageListResponseSchema = z.object({
  items: z.array(messageResponseSchema),
});

export type MessageListResponse = z.infer<typeof messageListResponseSchema>;
