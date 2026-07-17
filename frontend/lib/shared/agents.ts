import { z } from "zod";

export const agentTonePresetSchema = z.enum([
  "friendly",
  "professional",
  "casual",
]);

export type AgentTonePreset = z.infer<typeof agentTonePresetSchema>;

/** System presets reserved — cannot create via POST /api/agents. */
export const SYSTEM_AGENT_PRESET_IDS = [
  "quick-assistant",
  "orchestrator",
  "mother",
] as const;

export type SystemAgentPresetId = (typeof SYSTEM_AGENT_PRESET_IDS)[number];

export const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(280).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  tonePreset: agentTonePresetSchema.default("friendly"),
  toneNotes: z.string().trim().max(500).optional(),
  role: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).optional(),
  presetId: z.string().trim().min(1).max(64).optional(),
  enabledSkillGroups: z.array(z.string().trim().min(1).max(64)).max(32).default([]),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const agentResponseSchema = z.object({
  id: z.string(),
  ownerId: z.string().nullable(),
  isSystem: z.boolean(),
  presetId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  role: z.string(),
  description: z.string().nullable(),
  tonePreset: agentTonePresetSchema,
  toneNotes: z.string().nullable(),
  enabledSkillGroups: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;

export const agentListResponseSchema = z.object({
  items: z.array(agentResponseSchema),
});

export type AgentListResponse = z.infer<typeof agentListResponseSchema>;

/** Mother DM = Session bound to AucoMother (system). */
export const motherDmResponseSchema = z.object({
  conversation: z.object({
    id: z.string(),
    type: z.literal("session"),
    title: z.string(),
    description: z.string().nullable(),
    lastMessageAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  mother: agentResponseSchema,
});

export type MotherDmResponse = z.infer<typeof motherDmResponseSchema>;

/** User-agent DM = Session bound to owned agent. */
export const agentDmResponseSchema = z.object({
  conversation: motherDmResponseSchema.shape.conversation,
  agent: agentResponseSchema,
});

export type AgentDmResponse = z.infer<typeof agentDmResponseSchema>;
