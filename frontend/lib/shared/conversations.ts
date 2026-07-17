import { z } from "zod";

export const conversationTypeSchema = z.enum(["room", "session"]);

export type ConversationType = z.infer<typeof conversationTypeSchema>;

export const createConversationSchema = z.object({
  type: conversationTypeSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const conversationResponseSchema = z.object({
  id: z.string(),
  type: conversationTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ConversationResponse = z.infer<typeof conversationResponseSchema>;

export const conversationListResponseSchema = z.object({
  items: z.array(conversationResponseSchema),
});

export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>;
