import { z } from 'zod';

export const KnowledgeDomainSchema = z.enum([
  'credit',
  'legal',
  'product',
  'ops',
]);

export const OperationTypeSchema = z.enum([
  'create_doc',
  'patch_doc',
  'supersede_doc',
  'amend_relation',
  'replaces_clause',
  'noop',
]);

export const KnowledgeOperationSchema = z.object({
  id: z.string().min(1),
  type: OperationTypeSchema,
  title: z.string().min(1),
  content: z.string().optional(),
  targetDocId: z.string().nullable().optional(),
  beforeExcerpt: z.string().nullable().optional(),
  afterExcerpt: z.string().nullable().optional(),
  relationType: z
    .enum(['amends', 'supersedes', 'replaces_clause'])
    .nullable()
    .optional(),
  relationNote: z.string().nullable().optional(),
  selected: z.boolean().default(true),
});

export const ChangeProposalPayloadSchema = z.object({
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()).default([]),
  operations: z.array(KnowledgeOperationSchema).min(1),
});

export type KnowledgeOperation = z.infer<typeof KnowledgeOperationSchema>;
export type ChangeProposalPayload = z.infer<typeof ChangeProposalPayloadSchema>;

export const CreateIngestJobDtoSchema = z.object({
  domain: KnowledgeDomainSchema,
  sourceType: z.enum(['upload', 'url']),
  sourceUri: z.string().url().nullable().optional(),
  fileName: z.string().nullable().optional(),
  rawText: z.string().min(1).optional(),
});

export type CreateIngestJobDto = z.infer<typeof CreateIngestJobDtoSchema>;

export const ReviewProposalDtoSchema = z.object({
  reviewNote: z.string().nullable().optional(),
  /** When provided, only these operation ids are applied (approve path). */
  selectedOperationIds: z.array(z.string()).optional(),
});

export type ReviewProposalDto = z.infer<typeof ReviewProposalDtoSchema>;
