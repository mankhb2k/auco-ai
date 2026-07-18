import type {
  KnowledgeUiDocument,
  KnowledgeUiProposal,
} from "@/lib/mock/governance";
import { apiFetch } from "./client";
import { mapKnowledgeDoc, mapKnowledgeProposal } from "./mappers";

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

export async function listKnowledgeProposals(
  employeeId: string,
  query?: { domain?: string; status?: string },
): Promise<KnowledgeUiProposal[]> {
  const rows = await apiFetch<unknown[]>("/api/knowledge/ingest/proposals", {
    employeeId,
    query,
  });
  return rows.map(mapKnowledgeProposal);
}

export async function createIngestJob(opts: {
  employeeId: string;
  domain: KnowledgeUiDocument["domain"];
  sourceType: "upload" | "url";
  rawText?: string;
  fileName?: string | null;
  sourceUri?: string | null;
}): Promise<{ jobId: string; proposal: KnowledgeUiProposal | null }> {
  const raw = await apiFetch<{
    id?: string;
    domain?: string;
    sourceType?: string;
    fileName?: string | null;
    sourceUri?: string | null;
    proposal?: unknown;
  }>("/api/knowledge/ingest/jobs", {
    method: "POST",
    employeeId: opts.employeeId,
    body: {
      domain: opts.domain,
      sourceType: opts.sourceType,
      rawText: opts.rawText,
      fileName: opts.fileName ?? undefined,
      sourceUri: opts.sourceUri ?? undefined,
    },
  });
  const jobId = String(raw.id ?? "");
  return {
    jobId,
    proposal: raw.proposal
      ? mapKnowledgeProposal({
          ...raw.proposal,
          jobId,
          domain: raw.domain ?? opts.domain,
          job: raw,
        })
      : null,
  };
}

export async function approveProposalApi(
  proposalId: string,
  employeeId: string,
): Promise<KnowledgeUiProposal> {
  const raw = await apiFetch<{ proposal: unknown }>(
    `/api/knowledge/ingest/proposals/${proposalId}/approve`,
    {
      method: "POST",
      employeeId,
      body: {},
    },
  );
  return mapKnowledgeProposal(raw.proposal);
}

export async function rejectProposalApi(
  proposalId: string,
  employeeId: string,
  reviewNote?: string,
): Promise<KnowledgeUiProposal> {
  const raw = await apiFetch<{ proposal: unknown }>(
    `/api/knowledge/ingest/proposals/${proposalId}/reject`,
    {
      method: "POST",
      employeeId,
      body: { reviewNote: reviewNote ?? "Từ chối từ chat" },
    },
  );
  return mapKnowledgeProposal(raw.proposal);
}
