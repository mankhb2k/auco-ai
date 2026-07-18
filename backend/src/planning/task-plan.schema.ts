import { z } from 'zod';

export const AgentRoleSchema = z.enum(['credit', 'legal', 'product', 'ops']);

/**
 * OpenAI strict structured output yêu cầu mọi key trong `properties`
 * đều nằm trong `required` — không dùng `.optional()` ở đây.
 * Model luôn trả đủ field; caller có thể dùng giá trị rỗng / default.
 */
export const TaskStepPlanSchema = z.object({
  id: z.string().min(1),
  agentRole: AgentRoleSchema,
  goal: z.string().min(1),
  dependsOn: z.array(z.string()),
  requiredCapabilities: z.array(z.string()),
  mode: z.enum(['direct', 'spawn_workers']),
});

export const TaskPlanSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(TaskStepPlanSchema).min(1).max(5),
});

export type TaskStepPlan = z.infer<typeof TaskStepPlanSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;

export const MAX_STEPS_OFFSCRIPT = 5;
export const DEMO_STEPS = 3;
