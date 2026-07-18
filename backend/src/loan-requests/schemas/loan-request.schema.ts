import { z } from 'zod';

const money = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+$/.test(value) && BigInt(value) > 0n, {
    message: 'must be a positive integer VND amount',
  });

export const IntakeLoanRequestSchema = z.object({
  externalRef: z.string().trim().min(3).max(80),
  customerNo: z.string().trim().min(3).max(40),
  requestedAmountVnd: money,
  loanPurpose: z.string().trim().min(3).max(300),
  requestedTermMonths: z.number().int().min(1).max(480),
  declaredIncomeVnd: money.optional(),
  collateralType: z.string().trim().max(120).nullable().optional(),
  estimatedCollateralVnd: money.optional(),
  source: z.string().trim().min(2).max(40).default('mobile_app'),
  note: z.string().trim().max(1000).optional(),
});

export const AssignLoanRequestSchema = z.object({
  employeeId: z.string().trim().min(1),
});

export const AssessmentTagSchema = z.enum([
  'recommend_approve',
  'manual_review',
  'needs_documents',
  'recommend_reject',
]);

export const SubmitApprovalSchema = z.object({
  assessmentTag: AssessmentTagSchema,
  staffNote: z.string().trim().min(5).max(2000),
});

export const SetAssessmentTagSchema = z.object({
  assessmentTag: AssessmentTagSchema,
});

export const DecisionSchema = z.object({
  decisionNote: z.string().trim().min(5).max(2000),
});

export const ApproveSchema = z.object({
  decisionNote: z.string().trim().max(2000).optional(),
});

export type IntakeLoanRequestInput = z.infer<typeof IntakeLoanRequestSchema>;
