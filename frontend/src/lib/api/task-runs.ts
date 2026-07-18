import type { OrchestrationMode, TaskRun } from "@/lib/types/domain";
import { apiFetch } from "./client";
import { mapTaskRun } from "./mappers";

export async function createTaskRunApi(opts: {
  goal: string;
  employeeId: string;
  mode?: OrchestrationMode;
  async?: boolean;
  skipApprovalPropose?: boolean;
}): Promise<TaskRun> {
  const raw = await apiFetch<unknown>("/api/task-runs", {
    method: "POST",
    employeeId: opts.employeeId,
    body: {
      goal: opts.goal,
      mode: opts.mode ?? "multi",
      async: opts.async === true,
      skipApprovalPropose: opts.skipApprovalPropose === true,
    },
  });
  return mapTaskRun(raw);
}

export async function getTaskRunApi(
  id: string,
  employeeId: string,
): Promise<TaskRun> {
  return mapTaskRun(
    await apiFetch<unknown>(`/api/task-runs/${id}`, { employeeId }),
  );
}

export async function listTaskRunsApi(
  employeeId: string,
  limit = 20,
): Promise<TaskRun[]> {
  const rows = await apiFetch<unknown[]>("/api/task-runs", {
    employeeId,
    query: { limit },
  });
  return rows.map(mapTaskRun);
}
