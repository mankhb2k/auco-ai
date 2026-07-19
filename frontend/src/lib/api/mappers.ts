import type { KnowledgeUiDocument } from "@/lib/mock/governance";
import type {
  AgentRole,
  AuditEvent,
  Employee,
  LoanRequest,
  LoanRequestStatus,
  OrchestrationMode,
  RagCitation,
  ScenarioId,
  TaskRun,
  TaskRunStatus,
  TaskStep,
  TaskStepStatus,
  ToolCallRecord,
} from "@/lib/types/domain";

const AGENT_LABEL: Record<string, string> = {
  credit: "Tín dụng",
  legal: "Pháp lý / Tuân thủ",
  collateral: "Tài sản bảo đảm",
  product: "Sản phẩm",
  ops: "Vận hành",
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function iso(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return undefined;
}

function detectScenario(goal: string): ScenarioId {
  const g = goal.toLowerCase();
  if (
    g.includes("50 tỷ") ||
    g.includes("nhà máy") ||
    g.includes("mekong") ||
    g.includes("doanh nghiệp")
  ) {
    return "corporate";
  }
  if (g.includes("usd") || g.includes("ngoại tệ") || g.includes("fx")) {
    return "fx";
  }
  return "home";
}

function mapToolCall(raw: unknown, index: number): ToolCallRecord {
  const o = asRecord(raw) ?? {};
  return {
    id: typeof o.id === "string" ? o.id : `tc-${index}`,
    tool: typeof o.tool === "string" ? o.tool : "unknown",
    mcp: typeof o.mcp === "string" ? o.mcp : "unknown",
    mutates: o.mutates === true,
    input: asRecord(o.input) ?? {},
    output: asRecord(o.output) ?? undefined,
    latencyMs: typeof o.latencyMs === "number" ? o.latencyMs : undefined,
  };
}

function citationsFrom(output: Record<string, unknown> | null, toolCalls: ToolCallRecord[]): RagCitation[] {
  const fromOut = asArray(output?.citations);
  const list: RagCitation[] = [];
  for (const c of fromOut) {
    const r = asRecord(c);
    if (!r) continue;
    list.push({
      sourceDoc: String(r.sourceDoc ?? r.title ?? "Nguồn"),
      section: String(r.section ?? ""),
      score: typeof r.score === "number" ? r.score : 0,
    });
  }
  for (const tc of toolCalls) {
    const cites = asArray(tc.output?.citations);
    for (const c of cites) {
      const r = asRecord(c);
      if (!r) continue;
      list.push({
        sourceDoc: String(r.sourceDoc ?? r.title ?? tc.tool),
        section: String(r.section ?? ""),
        score: typeof r.score === "number" ? r.score : 0,
      });
    }
  }
  return list;
}

export function mapEmployee(raw: unknown): Employee {
  const o = asRecord(raw) ?? {};
  const layer = o.accessLayer;
  return {
    id: String(o.id ?? ""),
    bankCode: String(o.bankCode ?? "SHB"),
    displayName: String(o.displayName ?? o.id ?? "Employee"),
    role: String(o.role ?? "credit_officer"),
    accessLayer:
      layer === "manager" || layer === "it_admin" || layer === "employee"
        ? layer
        : "employee",
    branchCode:
      o.branchCode === null || o.branchCode === undefined
        ? null
        : String(o.branchCode),
  };
}

export function mapTaskStep(raw: unknown): TaskStep {
  const o = asRecord(raw) ?? {};
  const role = String(o.agentRole ?? "credit") as Exclude<AgentRole, "planner">;
  const input = asRecord(o.input) ?? {};
  const output = asRecord(o.output);
  const toolCalls = asArray(o.toolCalls).map(mapToolCall);
  const citations = citationsFrom(output, toolCalls);
  const goalHint =
    typeof input.goal === "string"
      ? input.goal
      : typeof output?.summary === "string"
        ? String(output.summary)
        : AGENT_LABEL[role] ?? role;

  const approvalReason =
    output?.approvalReason === "out_of_portfolio_access" ||
    output?.reason === "out_of_portfolio_access"
      ? "out_of_portfolio_access"
      : output?.pendingApproval === true ||
          toolCalls.some((t) => t.mutates && String(o.status) === "waiting_approval")
        ? "mutates"
        : undefined;

  return {
    id: String(o.id ?? ""),
    taskRunId: String(o.taskRunId ?? ""),
    agentRole: ["credit", "legal", "collateral", "product", "ops"].includes(role)
      ? role
      : "credit",
    mode: o.mode === "spawn_workers" ? "spawn_workers" : "direct",
    label: goalHint.slice(0, 120),
    input,
    output: output ?? undefined,
    status: (["pending", "running", "waiting_approval", "done", "failed"].includes(
      String(o.status),
    )
      ? String(o.status)
      : "pending") as TaskStepStatus,
    dependsOn: asArray(o.dependsOn).map(String),
    toolCalls,
    citations,
    approvalReason,
    approvalPreview:
      typeof output?.summary === "string"
        ? output.summary
        : typeof output?.preview === "string"
          ? output.preview
          : undefined,
    assessment:
      typeof output?.summary === "string" ? output.summary : undefined,
    startedAt: iso(o.startedAt),
    finishedAt: iso(o.finishedAt),
  };
}

export function mapTaskRun(raw: unknown): TaskRun {
  const o = asRecord(raw) ?? {};
  const plan = asRecord(o.planJson) ?? {};
  const steps = asArray(o.steps).map(mapTaskStep);
  const goal = String(o.goal ?? "");
  const mode: OrchestrationMode =
    plan.orchestrationMode === "single" || o.mode === "single"
      ? "single"
      : "multi";
  const allCitations = steps.flatMap((s) => s.citations);
  const createdAt = iso(o.createdAt) ?? new Date().toISOString();
  const finishedHint = steps
    .map((s) => s.finishedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const wallClockMs =
    finishedHint && createdAt
      ? Math.max(0, new Date(finishedHint).getTime() - new Date(createdAt).getTime())
      : 0;

  return {
    id: String(o.id ?? ""),
    bankCode: String(o.bankCode ?? "SHB"),
    employeeId: String(o.employeeId ?? ""),
    goal,
    status: (["planning", "running", "done", "failed"].includes(String(o.status))
      ? String(o.status)
      : steps.some((s) => s.status === "waiting_approval")
        ? "running"
        : "planning") as TaskRunStatus,
    mode,
    scenario: detectScenario(goal),
    planJson: {
      summary:
        typeof plan.summary === "string" ? plan.summary : "Kế hoạch điều phối",
    },
    finalAnswer:
      typeof o.finalAnswer === "string" ? o.finalAnswer : undefined,
    suggestedAssessmentTag: (
      [
        "recommend_approve",
        "manual_review",
        "needs_documents",
        "recommend_reject",
      ].includes(String(o.suggestedAssessmentTag))
        ? String(o.suggestedAssessmentTag)
        : null
    ) as TaskRun["suggestedAssessmentTag"],
    policyGateReasons: asArray(o.policyGateReasons).filter(
      (x): x is string => typeof x === "string",
    ),
    citations: allCitations,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      wallClockMs,
      events: [],
    },
    createdAt,
    steps,
  };
}

function mapLoanActor(raw: unknown) {
  const actor = asRecord(raw);
  if (!actor) return null;
  return {
    id: String(actor.id ?? ""),
    displayName: String(actor.displayName ?? ""),
    role: String(actor.role ?? ""),
    branchCode:
      actor.branchCode === null || actor.branchCode === undefined
        ? null
        : String(actor.branchCode),
  };
}

export function mapLoanRequest(raw: unknown): LoanRequest {
  const o = asRecord(raw) ?? {};
  const customer = asRecord(o.customer) ?? {};
  const rawStatus = String(o.status ?? "unassigned");
  const status = (
    [
      "unassigned",
      "assigned",
      "assessing",
      "advised",
      "pending_approval",
      "approved",
      "rejected",
      "escalated",
      "needs_info",
      "failed",
    ].includes(rawStatus)
      ? rawStatus
      : "unassigned"
  ) as LoanRequestStatus;
  const rawDecision = o.decision == null ? null : String(o.decision);
  const decision = (
    rawDecision &&
    ["approved", "rejected", "returned", "escalated"].includes(rawDecision)
      ? rawDecision
      : null
  ) as LoanRequest["decision"];

  return {
    id: String(o.id ?? ""),
    bankCode: String(o.bankCode ?? "SHB"),
    externalRef: String(o.externalRef ?? ""),
    customer: {
      id: String(customer.id ?? ""),
      customerNo: String(customer.customerNo ?? ""),
      fullName: String(customer.fullName ?? ""),
      branchCode:
        customer.branchCode === null || customer.branchCode === undefined
          ? null
          : String(customer.branchCode),
      nationalIdMasked:
        customer.nationalIdMasked === null ||
        customer.nationalIdMasked === undefined
          ? null
          : String(customer.nationalIdMasked),
      bankAccountNumberMasked:
        customer.bankAccountNumberMasked === null ||
        customer.bankAccountNumberMasked === undefined
          ? null
          : String(customer.bankAccountNumberMasked),
      availableBalanceMasked:
        customer.availableBalanceMasked === null ||
        customer.availableBalanceMasked === undefined
          ? null
          : String(customer.availableBalanceMasked),
    },
    assignedTo: mapLoanActor(o.assignedTo),
    submittedBy: mapLoanActor(o.submittedBy),
    decidedBy: mapLoanActor(o.decidedBy),
    requestedAmountVnd: String(o.requestedAmountVnd ?? "0"),
    loanPurpose: String(o.loanPurpose ?? ""),
    requestedTermMonths: Number(o.requestedTermMonths ?? 0),
    declaredIncomeVnd:
      o.declaredIncomeVnd === null || o.declaredIncomeVnd === undefined
        ? null
        : String(o.declaredIncomeVnd),
    collateralType:
      o.collateralType === null || o.collateralType === undefined
        ? null
        : String(o.collateralType),
    estimatedCollateralVnd:
      o.estimatedCollateralVnd === null ||
      o.estimatedCollateralVnd === undefined
        ? null
        : String(o.estimatedCollateralVnd),
    source: String(o.source ?? "mobile_app"),
    note: o.note === null || o.note === undefined ? null : String(o.note),
    status,
    assignedAt: iso(o.assignedAt) ?? null,
    assessmentStartedAt: iso(o.assessmentStartedAt) ?? null,
    assessmentTag: (
      [
        "recommend_approve",
        "manual_review",
        "needs_documents",
        "recommend_reject",
      ].includes(String(o.assessmentTag))
        ? String(o.assessmentTag)
        : null
    ) as LoanRequest["assessmentTag"],
    staffNote:
      o.staffNote === null || o.staffNote === undefined
        ? null
        : String(o.staffNote),
    submittedAt: iso(o.submittedAt) ?? null,
    decision,
    decisionNote:
      o.decisionNote === null || o.decisionNote === undefined
        ? null
        : String(o.decisionNote),
    decidedAt: iso(o.decidedAt) ?? null,
    branchApprovalLimitVnd: String(o.branchApprovalLimitVnd ?? "5000000000"),
    exceedsBranchLimit: Boolean(o.exceedsBranchLimit),
    createdAt: iso(o.createdAt) ?? new Date().toISOString(),
    assessmentTaskRun: o.assessmentTaskRun
      ? mapTaskRun(o.assessmentTaskRun)
      : null,
  };
}

export function mapAuditEvent(raw: unknown): AuditEvent {
  const o = asRecord(raw) ?? {};
  return {
    id: String(o.id ?? ""),
    actorId: String(o.actorId ?? ""),
    action: String(o.action ?? ""),
    resource: String(o.resource ?? ""),
    detail: asRecord(o.detailJson),
    createdAt: iso(o.createdAt) ?? new Date().toISOString(),
  };
}

export function mapKnowledgeDoc(raw: unknown): KnowledgeUiDocument {
  const o = asRecord(raw) ?? {};
  const domain = String(o.domain ?? "credit");
  return {
    id: String(o.id ?? ""),
    domain: (["credit", "legal", "collateral", "product", "ops"].includes(domain)
      ? domain
      : "credit") as KnowledgeUiDocument["domain"],
    title: String(o.title ?? ""),
    content: String(o.content ?? ""),
    status: (["draft", "active", "superseded"].includes(String(o.status))
      ? String(o.status)
      : "draft") as KnowledgeUiDocument["status"],
    updatedAt: iso(o.updatedAt) ?? new Date().toISOString(),
    publishedAt: iso(o.publishedAt) ?? null,
  };
}
