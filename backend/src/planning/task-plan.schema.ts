import { z } from 'zod';

export const AgentRoleSchema = z.enum(['credit', 'legal', 'product', 'ops']);

export const TaskStepPlanSchema = z.object({
  id: z.string().min(1),
  agentRole: AgentRoleSchema,
  goal: z.string().min(1),
  dependsOn: z.array(z.string()),
  requiredCapabilities: z.array(z.string()).optional(),
  mode: z.enum(['direct', 'spawn_workers']).optional(),
});

export const TaskPlanSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(TaskStepPlanSchema).min(1).max(5),
});

export type TaskStepPlan = z.infer<typeof TaskStepPlanSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;

export const MAX_STEPS_OFFSCRIPT = 5;
export const DEMO_STEPS = 3;
