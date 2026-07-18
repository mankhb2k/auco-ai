-- Phase 6 RAG: pgvector chunks + full-text (hybrid retrieve)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',
    "domain" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "searchVector" tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce("content", ''))
    ) STORED,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_docId_idx" ON "KnowledgeChunk"("docId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_bankCode_domain_idx" ON "KnowledgeChunk"("bankCode", "domain");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_searchVector_idx" ON "KnowledgeChunk" USING GIN ("searchVector");

ALTER TABLE "KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_docId_fkey"
    FOREIGN KEY ("docId") REFERENCES "KnowledgeDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
