import type { LoanAssessmentTag, LoanRequest } from "@/lib/types/domain";
import { apiFetch } from "./client";
import { mapLoanRequest } from "./mappers";

export async function listLoanRequestsApi(
  employeeId: string,
  status?: string,
): Promise<LoanRequest[]> {
  const rows = await apiFetch<unknown[]>("/api/loan-requests", {
    employeeId,
    query: { status },
  });
  return rows.map(mapLoanRequest);
}

export async function assignLoanRequestApi(opts: {
  id: string;
  employeeId: string;
  assigneeId: string;
}): Promise<LoanRequest> {
  return mapLoanRequest(
    await apiFetch<unknown>(`/api/loan-requests/${opts.id}/assign`, {
      method: "POST",
      employeeId: opts.employeeId,
      body: { employeeId: opts.assigneeId },
    }),
  );
}

export async function startLoanAssessmentApi(
  id: string,
  employeeId: string,
): Promise<LoanRequest> {
  return mapLoanRequest(
    await apiFetch<unknown>(`/api/loan-requests/${id}/start-assessment`, {
      method: "POST",
      employeeId,
    }),
  );
}

export async function submitLoanApprovalApi(opts: {
  id: string;
  employeeId: string;
  assessmentTag: LoanAssessmentTag;
  staffNote: string;
}): Promise<LoanRequest> {
  return mapLoanRequest(
    await apiFetch<unknown>(`/api/loan-requests/${opts.id}/submit-approval`, {
      method: "POST",
      employeeId: opts.employeeId,
      body: {
        assessmentTag: opts.assessmentTag,
        staffNote: opts.staffNote,
      },
    }),
  );
}

export async function setLoanAssessmentTagApi(opts: {
  id: string;
  employeeId: string;
  assessmentTag: LoanAssessmentTag;
}): Promise<LoanRequest> {
  return mapLoanRequest(
    await apiFetch<unknown>(
      `/api/loan-requests/${opts.id}/assessment-tag`,
      {
        method: "POST",
        employeeId: opts.employeeId,
        body: { assessmentTag: opts.assessmentTag },
      },
    ),
  );
}

export async function approveLoanRequestApi(opts: {
  id: string;
  employeeId: string;
  decisionNote?: string;
}): Promise<LoanRequest> {
  return mapLoanRequest(
    await apiFetch<unknown>(`/api/loan-requests/${opts.id}/approve`, {
      method: "POST",
      employeeId: opts.employeeId,
      body: { decisionNote: opts.decisionNote },
    }),
  );
}

export async function rejectLoanRequestApi(opts: {
  id: string;
  employeeId: string;
  decisionNote: string;
}): Promise<LoanRequest> {
  return mapLoanRequest(
    await apiFetch<unknown>(`/api/loan-requests/${opts.id}/reject`, {
      method: "POST",
      employeeId: opts.employeeId,
      body: { decisionNote: opts.decisionNote },
    }),
  );
}

export async function returnLoanRequestApi(opts: {
  id: string;
  employeeId: string;
  decisionNote: string;
}): Promise<LoanRequest> {
  return mapLoanRequest(
    await apiFetch<unknown>(`/api/loan-requests/${opts.id}/return-for-info`, {
      method: "POST",
      employeeId: opts.employeeId,
      body: { decisionNote: opts.decisionNote },
    }),
  );
}
