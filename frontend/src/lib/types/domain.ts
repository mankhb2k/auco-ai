export type AgentRole = "credit" | "legal" | "product" | "ops" | "planner";

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

export interface Employee {
  id: string;
  bankCode: string;
  displayName: string;
  role: string;
  branchCode: string;
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

export type AutomationStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "paused";

export interface Automation {
  id: string;
  name: string;
  description?: string;
  createdByAgentRole: Exclude<AgentRole, "planner">;
  triggerType: "schedule" | "manual";
  cronExpr?: string;
  timezone: string;
  enabled: boolean;
  status: AutomationStatus;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  status: "running" | "done" | "failed";
  startedAt: string;
  finishedAt?: string;
  resultSummary?: string;
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
