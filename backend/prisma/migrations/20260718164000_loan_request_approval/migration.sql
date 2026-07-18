-- AlterTable
ALTER TABLE "LoanRequest" ADD COLUMN "staffNote" TEXT;
ALTER TABLE "LoanRequest" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "LoanRequest" ADD COLUMN "submittedById" TEXT;
ALTER TABLE "LoanRequest" ADD COLUMN "decision" TEXT;
ALTER TABLE "LoanRequest" ADD COLUMN "decisionNote" TEXT;
ALTER TABLE "LoanRequest" ADD COLUMN "decidedAt" TIMESTAMP(3);
ALTER TABLE "LoanRequest" ADD COLUMN "decidedById" TEXT;

-- AddForeignKey
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
