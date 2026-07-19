import type { AuditEvent } from "@/lib/types/domain";
import { apiFetch } from "./client";
import { mapAuditEvent } from "./mappers";

export async function listAuditEventsApi(opts: {
  employeeId: string;
  resource?: string;
  limit?: number;
}): Promise<AuditEvent[]> {
  const rows = await apiFetch<unknown[]>("/api/audit-events", {
    employeeId: opts.employeeId,
    query: { resource: opts.resource, limit: opts.limit },
  });
  return rows.map(mapAuditEvent);
}
