-- role.md Phase R3: Knowledge Owner draft/publish workflow
ALTER TABLE "KnowledgeDocument"
    ADD COLUMN IF NOT EXISTS "uploadedById" TEXT,
    ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "KnowledgeDocument_uploadedById_idx"
    ON "KnowledgeDocument"("uploadedById");

ALTER TABLE "KnowledgeDocument"
    ADD CONSTRAINT "KnowledgeDocument_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing active seed documents are treated as already published.
UPDATE "KnowledgeDocument"
SET "publishedAt" = COALESCE("publishedAt", "createdAt")
WHERE "status" = 'active';
