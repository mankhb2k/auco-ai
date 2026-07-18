import type { CompareMetrics } from "@/lib/types/domain";
import { apiFetch } from "./client";
import { mapCompareMetrics } from "./mappers";

export type CompareApiResult = {
  goal: string;
  bankCode: string;
  multi: CompareMetrics;
  single: CompareMetrics;
  verdict: string;
};

export async function runCompareApi(opts: {
  goal: string;
  employeeId: string;
}): Promise<CompareApiResult> {
  const raw = await apiFetch<{
    goal: string;
    bankCode: string;
    multi: unknown;
    single: unknown;
    verdict: string;
  }>("/api/compare", {
    method: "POST",
    employeeId: opts.employeeId,
    body: { goal: opts.goal, bankCode: "SHB" },
  });
  return {
    goal: raw.goal,
    bankCode: raw.bankCode,
    multi: mapCompareMetrics(raw.multi),
    single: mapCompareMetrics(raw.single),
    verdict: raw.verdict,
  };
}
