-- Deterministic policy gate (LTV/AML) — suggested tag không chỉ dựa vào LLM.
ALTER TABLE "TaskRun" ADD COLUMN "suggestedAssessmentTag" TEXT;
ALTER TABLE "TaskRun" ADD COLUMN "policyGateReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
