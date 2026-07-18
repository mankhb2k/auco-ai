import type { McpUiCapability, McpUiSuite } from "@/lib/mock/governance";
import { apiFetch } from "./client";
import { mapMcpSuite } from "./mappers";

export async function getMcpSuite(employeeId: string): Promise<McpUiSuite> {
  return mapMcpSuite(
    await apiFetch<unknown>("/api/mcp/suite", { employeeId }),
  );
}

export async function setMcpConnectorEnabled(
  capability: McpUiCapability,
  enabled: boolean,
  employeeId: string,
): Promise<void> {
  await apiFetch(`/api/mcp/connectors/${capability}`, {
    method: "PATCH",
    employeeId,
    body: { enabled },
  });
}
