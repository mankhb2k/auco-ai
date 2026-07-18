import { getAgentByRole, type AgentRole } from '../agents/agent-catalog';
import {
  DEMO_STEPS,
  MAX_STEPS_OFFSCRIPT,
  type TaskPlan,
  type TaskStepPlan,
} from './task-plan.schema';

export type PlanValidationResult =
  | { ok: true; plan: TaskPlan }
  | { ok: false; errors: string[] };

export function validateTaskPlan(
  plan: TaskPlan,
  opts?: { demoPinned?: boolean },
): PlanValidationResult {
  const errors: string[] = [];
  const maxSteps = opts?.demoPinned ? DEMO_STEPS : MAX_STEPS_OFFSCRIPT;

  if (plan.steps.length === 0) {
    errors.push('Plan has no steps');
  }
  if (plan.steps.length > maxSteps) {
    errors.push(`Too many steps: ${plan.steps.length} > ${maxSteps}`);
  }

  const ids = new Set<string>();
  for (const step of plan.steps) {
    if (ids.has(step.id)) {
      errors.push(`Duplicate step id: ${step.id}`);
    }
    ids.add(step.id);

    try {
      getAgentByRole(step.agentRole as AgentRole);
    } catch {
      errors.push(`Unknown agentRole: ${step.agentRole}`);
    }

    if (step.requiredCapabilities?.length) {
      const agent = getAgentByRole(step.agentRole as AgentRole);
      for (const cap of step.requiredCapabilities) {
        if (!agent.capabilities.includes(cap)) {
          errors.push(
            `Step ${step.id}: capability "${cap}" not allowed for role ${step.agentRole}`,
          );
        }
      }
    }

    for (const dep of step.dependsOn) {
      if (!ids.has(dep) && !plan.steps.some((s) => s.id === dep)) {
        // dep may appear later in array — check full plan after loop
      }
    }
  }

  const allIds = new Set(plan.steps.map((s) => s.id));
  for (const step of plan.steps) {
    for (const dep of step.dependsOn) {
      if (!allIds.has(dep)) {
        errors.push(`Step ${step.id}: dependsOn missing id "${dep}"`);
      }
      if (dep === step.id) {
        errors.push(`Step ${step.id}: self-dependency`);
      }
    }
  }

  if (hasCycle(plan.steps)) {
    errors.push('Plan has a dependency cycle');
  }

  if (errors.length) {
    return { ok: false, errors };
  }
  return { ok: true, plan };
}

function hasCycle(steps: TaskStepPlan[]): boolean {
  const graph = new Map<string, string[]>();
  for (const s of steps) {
    graph.set(s.id, [...s.dependsOn]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dep of graph.get(id) ?? []) {
      // edge: step depends on dep → wait for dep first; cycle if we recurse into waiting chain wrongly
      // Represent as: id → dependsOn nodes (edges from id to deps). Cycle if back-edge.
      if (dfs(dep)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  for (const id of graph.keys()) {
    if (dfs(id)) return true;
  }
  return false;
}

/** Ready steps: all dependsOn are in `doneIds`. */
export function readySteps(
  steps: TaskStepPlan[],
  doneIds: Set<string>,
  startedOrDone: Set<string>,
): TaskStepPlan[] {
  return steps.filter(
    (s) =>
      !startedOrDone.has(s.id) &&
      s.dependsOn.every((d) => doneIds.has(d)),
  );
}
