CREATE TABLE "LoanRequest" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT 'SHB',
    "externalRef" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT,
    "assignedToId" TEXT,
    "assessmentTaskRunId" TEXT,
    "requestedAmountVnd" DECIMAL(20,0) NOT NULL,
    "loanPurpose" TEXT NOT NULL,
    "requestedTermMonths" INTEGER NOT NULL,
    "declaredIncomeVnd" DECIMAL(20,0),
    "collateralType" TEXT,
    "estimatedCollateralVnd" DECIMAL(20,0),
    "source" TEXT NOT NULL DEFAULT 'mobile_app',
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unassigned',
    "assignedAt" TIMESTAMP(3),
    "assessmentStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoanRequest_externalRef_key" ON "LoanRequest"("externalRef");
CREATE UNIQUE INDEX "LoanRequest_assessmentTaskRunId_key" ON "LoanRequest"("assessmentTaskRunId");
CREATE INDEX "LoanRequest_bankCode_status_createdAt_idx" ON "LoanRequest"("bankCode", "status", "createdAt");
CREATE INDEX "LoanRequest_bankCode_assignedToId_status_idx" ON "LoanRequest"("bankCode", "assignedToId", "status");
CREATE INDEX "LoanRequest_customerId_idx" ON "LoanRequest"("customerId");

ALTER TABLE "LoanRequest"
ADD CONSTRAINT "LoanRequest_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoanRequest"
ADD CONSTRAINT "LoanRequest_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoanRequest"
ADD CONSTRAINT "LoanRequest_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoanRequest"
ADD CONSTRAINT "LoanRequest_assessmentTaskRunId_fkey"
FOREIGN KEY ("assessmentTaskRunId") REFERENCES "TaskRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
