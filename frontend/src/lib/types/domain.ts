export type AgentRole =
  | "credit"
  | "legal"
  | "collateral"
  | "product"
  | "ops"
  | "planner";

export type TaskRunStatus = "planning" | "running" | "done" | "failed";

export type TaskStepStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "done"
  | "failed";

export type OrchestrationMode = "multi" | "single";

export type ScenarioId = "corporate" | "fx" | "home";

export type ApprovalReason = "mutates" | "out_of_portfolio_access";

export type UsageKind =
  | "llm_plan"
  | "llm_specialist"
  | "llm_worker"
  | "llm_synthesize"
  | "rag"
  | "tool";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD mock — OpenAI-style pricing */
  costUsd: number;
  model: string;
  latencyMs: number;
}

export interface UsageEvent {
  id: string;
  at: string;
  kind: UsageKind;
  agentRole: AgentRole;
  stepId?: string;
  label: string;
  usage: TokenUsage;
}

export interface RunUsageSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  wallClockMs: number;
  events: UsageEvent[];
}

export interface ToolCallRecord {
  id: string;
  tool: string;
  mcp: string;
  mutates: boolean;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  latencyMs?: number;
}

export interface RagCitation {
  sourceDoc: string;
  section: string;
  score: number;
}

export interface WorkerSpawn {
  id: string;
  label: string;
  status: TaskStepStatus;
  summary?: string;
}

export interface TaskStep {
  id: string;
  taskRunId: string;
  agentRole: Exclude<AgentRole, "planner">;
  mode: "direct" | "spawn_workers";
  label: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: TaskStepStatus;
  dependsOn: string[];
  toolCalls: ToolCallRecord[];
  citations: RagCitation[];
  workers?: WorkerSpawn[];
  approvalReason?: ApprovalReason;
  approvalPreview?: string;
  /** Nhận xét / đánh giá hiển thị trên chat (prose) */
  assessment?: string;
  usage?: TokenUsage;
  startedAt?: string;
  finishedAt?: string;
}

export interface TaskRun {
  id: string;
  bankCode: string;
  employeeId: string;
  goal: string;
  status: TaskRunStatus;
  mode: OrchestrationMode;
  scenario: ScenarioId;
  planJson: { summary: string };
  finalAnswer?: string;
  citations: RagCitation[];
  usage: RunUsageSummary;
  createdAt: string;
  steps: TaskStep[];
}

/** role.md §1 — 3 lớp quyền demo. */
export type AccessLayer = "it_admin" | "manager" | "employee";

export interface Employee {
  id: string;
  bankCode: string;
  displayName: string;
  role: string;
  accessLayer: AccessLayer;
  branchCode: string | null;
}

export interface Customer {
  id: string;
  bankCode: string;
  fullName: string;
  customerNo: string;
  branchCode: string;
}

export interface CustomerPortfolio {
  employeeId: string;
  customerId: string;
}

export type LoanRequestStatus =
  | "unassigned"
  | "assigned"
  | "assessing"
  | "advised"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "escalated"
  | "needs_info"
  | "failed";

export type LoanDecision =
  | "approved"
  | "rejected"
  | "returned"
  | "escalated";

export type LoanAssessmentTag =
  | "recommend_approve"
  | "manual_review"
  | "needs_documents"
  | "recommend_reject";

export interface LoanRequestActor {
  id: string;
  displayName: string;
  role: string;
  branchCode: string | null;
}

export interface LoanRequest {
  id: string;
  bankCode: string;
  externalRef: string;
  customer: {
    id: string;
    customerNo: string;
    fullName: string;
    branchCode: string | null;
  };
  assignedTo: LoanRequestActor | null;
  submittedBy: LoanRequestActor | null;
  decidedBy: LoanRequestActor | null;
  requestedAmountVnd: string;
  loanPurpose: string;
  requestedTermMonths: number;
  declaredIncomeVnd: string | null;
  collateralType: string | null;
  estimatedCollateralVnd: string | null;
  source: string;
  note: string | null;
  status: LoanRequestStatus;
  assignedAt: string | null;
  assessmentStartedAt: string | null;
  assessmentTag: LoanAssessmentTag | null;
  staffNote: string | null;
  submittedAt: string | null;
  decision: LoanDecision | null;
  decisionNote: string | null;
  decidedAt: string | null;
  branchApprovalLimitVnd: string;
  exceedsBranchLimit: boolean;
  createdAt: string;
  assessmentTaskRun: TaskRun | null;
}



export interface McpConnector {
  id: string;
  name: string;
  status: "connected" | "mock" | "offline";
  lastTool?: string;
}

export interface McpSuiteStatus {
  suite: string;
  connected: boolean;
  connectors: McpConnector[];
}

export interface CompareMetrics {
  mode: OrchestrationMode;
  latencyMs: number;
  toolAccuracy: number;
  citationCount: number;
  realActions: number;
  totalTokens: number;
  costUsd: number;
  notes: string[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  section: string;
  content: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "active" | "superseded";
  relation?: {
    type: "amends" | "supersedes";
    targetId: string;
  };
  ltvMaxPct?: number;
}
