import type { KnowledgeUiDocument } from "@/lib/mock/governance";
import { apiFetch } from "./client";
import { mapKnowledgeDoc } from "./mappers";

export async function listKnowledgeDocuments(
  employeeId: string,
  query?: { domain?: string; status?: string },
): Promise<KnowledgeUiDocument[]> {
  const rows = await apiFetch<unknown[]>("/api/knowledge/documents", {
    employeeId,
    query,
  });
  return rows.map(mapKnowledgeDoc);
}

export type KnowledgeHqSyncResult = {
  source: string;
  version: string;
  publishedBy: string;
  updatedAt: string;
  documents: number;
  skipped: number;
};

/** Đồng bộ tri thức chuẩn hóa từ API hội sở (mock) và re-index RAG. */
export async function syncKnowledgeFromHqApi(
  employeeId: string,
): Promise<KnowledgeHqSyncResult> {
  return apiFetch<KnowledgeHqSyncResult>("/api/knowledge/documents/sync", {
    method: "POST",
    employeeId,
  });
}
