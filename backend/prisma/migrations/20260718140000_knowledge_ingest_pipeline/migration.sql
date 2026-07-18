-- Phase R6: Knowledge Ingest Pipeline (upload/URL → Curator → manager review)

CREATE TABLE IF NOT EXISTS "KnowledgeIngestJob" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',
    "domain" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUri" TEXT,
    "fileName" TEXT,
    "rawText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeIngestJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeChangeProposal" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "summary" TEXT NOT NULL,
    "operationsJson" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "warningsJson" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChangeProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeChangeProposal_jobId_key" ON "KnowledgeChangeProposal"("jobId");
CREATE INDEX IF NOT EXISTS "KnowledgeIngestJob_bankCode_domain_idx" ON "KnowledgeIngestJob"("bankCode", "domain");
CREATE INDEX IF NOT EXISTS "KnowledgeIngestJob_status_idx" ON "KnowledgeIngestJob"("status");
CREATE INDEX IF NOT EXISTS "KnowledgeIngestJob_createdById_idx" ON "KnowledgeIngestJob"("createdById");
CREATE INDEX IF NOT EXISTS "KnowledgeChangeProposal_bankCode_domain_idx" ON "KnowledgeChangeProposal"("bankCode", "domain");
CREATE INDEX IF NOT EXISTS "KnowledgeChangeProposal_status_idx" ON "KnowledgeChangeProposal"("status");
CREATE INDEX IF NOT EXISTS "KnowledgeChangeProposal_reviewedById_idx" ON "KnowledgeChangeProposal"("reviewedById");

ALTER TABLE "KnowledgeIngestJob"
    ADD CONSTRAINT "KnowledgeIngestJob_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChangeProposal"
    ADD CONSTRAINT "KnowledgeChangeProposal_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "KnowledgeIngestJob"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChangeProposal"
    ADD CONSTRAINT "KnowledgeChangeProposal_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
