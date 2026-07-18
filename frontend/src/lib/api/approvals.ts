import { apiFetch } from "./client";
import { mapTaskRun } from "./mappers";
import type { TaskRun } from "@/lib/types/domain";

export async function approveStepApi(
  stepId: string,
  employeeId: string,
): Promise<TaskRun | null> {
  const raw = await apiFetch<{ taskRun?: unknown }>(
    `/api/approvals/${stepId}/approve`,
    {
      method: "POST",
      employeeId,
      body: {},
    },
  );
  return raw.taskRun ? mapTaskRun(raw.taskRun) : null;
}

export async function rejectStepApi(
  stepId: string,
  employeeId: string,
  reason?: string,
): Promise<TaskRun | null> {
  const raw = await apiFetch<{ taskRun?: unknown }>(
    `/api/approvals/${stepId}/reject`,
    {
      method: "POST",
      employeeId,
      body: { reason: reason ?? "Từ chối từ Dashboard" },
    },
  );
  return raw.taskRun ? mapTaskRun(raw.taskRun) : null;
}
