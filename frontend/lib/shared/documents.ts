import { z } from "zod";

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;

export const documentExtractStatusSchema = z.enum([
  "pending",
  "ready",
  "failed",
]);

export type DocumentExtractStatus = z.infer<typeof documentExtractStatusSchema>;

export const documentResponseSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  title: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  extractStatus: documentExtractStatusSchema,
  createdAt: z.string(),
});

export type DocumentResponse = z.infer<typeof documentResponseSchema>;

export const documentListResponseSchema = z.object({
  items: z.array(documentResponseSchema),
});

export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
