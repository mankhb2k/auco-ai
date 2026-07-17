-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "TaskRun" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',
    "employeeId" TEXT,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "finalAnswer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStep" (
    "id" TEXT NOT NULL,
    "taskRunId" TEXT NOT NULL,
    "agentRole" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'direct',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "dependsOn" TEXT[],
    "toolCalls" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "TaskStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "branchCode" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',
    "fullName" TEXT NOT NULL,
    "customerNo" TEXT NOT NULL,
    "branchCode" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPortfolio" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',

    CONSTRAINT "CustomerPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByAgentRole" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "cronExpr" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "graphJson" JSONB,
    "botVersionId" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "resultSummary" TEXT,
    "traceJson" JSONB,
    "actorId" TEXT,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRelation" (
    "id" TEXT NOT NULL,
    "fromDocId" TEXT NOT NULL,
    "toDocId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "DocumentRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskRun_bankCode_idx" ON "TaskRun"("bankCode");

-- CreateIndex
CREATE INDEX "TaskRun_status_idx" ON "TaskRun"("status");

-- CreateIndex
CREATE INDEX "TaskRun_createdAt_idx" ON "TaskRun"("createdAt");

-- CreateIndex
CREATE INDEX "TaskStep_taskRunId_idx" ON "TaskStep"("taskRunId");

-- CreateIndex
CREATE INDEX "TaskStep_status_idx" ON "TaskStep"("status");

-- CreateIndex
CREATE INDEX "Employee_bankCode_idx" ON "Employee"("bankCode");

-- CreateIndex
CREATE INDEX "Customer_bankCode_idx" ON "Customer"("bankCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_bankCode_customerNo_key" ON "Customer"("bankCode", "customerNo");

-- CreateIndex
CREATE INDEX "CustomerPortfolio_bankCode_idx" ON "CustomerPortfolio"("bankCode");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPortfolio_employeeId_customerId_key" ON "CustomerPortfolio"("employeeId", "customerId");

-- CreateIndex
CREATE INDEX "Automation_bankCode_idx" ON "Automation"("bankCode");

-- CreateIndex
CREATE INDEX "Automation_enabled_idx" ON "Automation"("enabled");

-- CreateIndex
CREATE INDEX "AutomationRun_automationId_idx" ON "AutomationRun"("automationId");

-- CreateIndex
CREATE INDEX "AutomationRun_status_idx" ON "AutomationRun"("status");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_bankCode_domain_idx" ON "KnowledgeDocument"("bankCode", "domain");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");

-- CreateIndex
CREATE INDEX "DocumentRelation_fromDocId_idx" ON "DocumentRelation"("fromDocId");

-- CreateIndex
CREATE INDEX "DocumentRelation_toDocId_idx" ON "DocumentRelation"("toDocId");

-- AddForeignKey
ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStep" ADD CONSTRAINT "TaskStep_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "TaskRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortfolio" ADD CONSTRAINT "CustomerPortfolio_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortfolio" ADD CONSTRAINT "CustomerPortfolio_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRelation" ADD CONSTRAINT "DocumentRelation_fromDocId_fkey" FOREIGN KEY ("fromDocId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRelation" ADD CONSTRAINT "DocumentRelation_toDocId_fkey" FOREIGN KEY ("toDocId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
