ALTER TABLE "LoanRequest"
ADD COLUMN "assessmentTag" TEXT;

CREATE INDEX "LoanRequest_bankCode_assessmentTag_idx"
ON "LoanRequest"("bankCode", "assessmentTag");
