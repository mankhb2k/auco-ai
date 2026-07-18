import type { AuditUiEvent } from "@/lib/mock/governance";
import { apiFetch } from "./client";
import { mapAuditEvent } from "./mappers";

export async function listAuditEvents(
  employeeId: string,
  limit = 50,
): Promise<AuditUiEvent[]> {
  const rows = await apiFetch<unknown[]>("/api/audit", {
    employeeId,
    query: { limit },
  });
  return rows.map(mapAuditEvent);
}
