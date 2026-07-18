import { apiFetch } from "./client";
import { mapEmployee } from "./mappers";
import type { Employee } from "@/lib/types/domain";

export async function listActors(employeeId?: string): Promise<Employee[]> {
  const rows = await apiFetch<unknown[]>("/api/actors", {
    employeeId,
    query: { bankCode: "SHB" },
  });
  return rows.map(mapEmployee);
}
