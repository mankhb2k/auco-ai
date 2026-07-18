import type {
  KnowledgeUiDocument,
  KnowledgeUiOperation,
  KnowledgeUiProposal,
  McpUiSuite,
  AuditUiEvent,
} from "@/lib/mock/governance";
import type {
  AgentRole,
  CompareMetrics,
  Employee,
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
    agentRole: ["credit", "legal", "product", "ops"].includes(role)
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

export function mapCompareMetrics(raw: unknown): CompareMetrics {
  const o = asRecord(raw) ?? {};
  return {
    mode: o.mode === "single" ? "single" : "multi",
    latencyMs: typeof o.latencyMs === "number" ? o.latencyMs : 0,
    toolAccuracy: typeof o.toolAccuracy === "number" ? o.toolAccuracy : 0,
    citationCount: typeof o.citationCount === "number" ? o.citationCount : 0,
    realActions: typeof o.realActions === "number" ? o.realActions : 0,
    totalTokens: typeof o.totalTokens === "number" ? o.totalTokens : 0,
    costUsd: typeof o.costUsd === "number" ? o.costUsd : 0,
    notes: asArray(o.notes).map(String),
  };
}

export function mapKnowledgeDoc(raw: unknown): KnowledgeUiDocument {
  const o = asRecord(raw) ?? {};
  const domain = String(o.domain ?? "credit");
  return {
    id: String(o.id ?? ""),
    domain: (["credit", "legal", "product", "ops"].includes(domain)
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

function mapOperation(raw: unknown): KnowledgeUiOperation {
  const o = asRecord(raw) ?? {};
  return {
    id: String(o.id ?? "op"),
    type: (o.type as KnowledgeUiOperation["type"]) ?? "noop",
    title: String(o.title ?? ""),
    content: typeof o.content === "string" ? o.content : undefined,
    targetDocId:
      o.targetDocId === null || o.targetDocId === undefined
        ? null
        : String(o.targetDocId),
    beforeExcerpt:
      typeof o.beforeExcerpt === "string" ? o.beforeExcerpt : null,
    afterExcerpt: typeof o.afterExcerpt === "string" ? o.afterExcerpt : null,
    relationType:
      (o.relationType as KnowledgeUiOperation["relationType"]) ?? null,
    relationNote:
      typeof o.relationNote === "string" ? o.relationNote : null,
    selected: o.selected !== false,
  };
}

export function mapKnowledgeProposal(raw: unknown): KnowledgeUiProposal {
  const o = asRecord(raw) ?? {};
  const job = asRecord(o.job);
  const opsRaw = o.operationsJson ?? o.operations;
  const warningsRaw = o.warningsJson ?? o.warnings;
  const domain = String(o.domain ?? job?.domain ?? "credit");
  const sourceType =
    String(job?.sourceType ?? o.sourceType ?? "upload") === "url"
      ? "url"
      : "upload";
  return {
    id: String(o.id ?? ""),
    jobId: String(o.jobId ?? job?.id ?? ""),
    domain: (["credit", "legal", "product", "ops"].includes(domain)
      ? domain
      : "credit") as KnowledgeUiDocument["domain"],
    status: (["pending_review", "approved", "rejected"].includes(
      String(o.status),
    )
      ? String(o.status)
      : "pending_review") as KnowledgeUiProposal["status"],
    summary: String(o.summary ?? ""),
    confidence: typeof o.confidence === "number" ? o.confidence : 0.5,
    warnings: asArray(warningsRaw).map(String),
    operations: asArray(opsRaw).map(mapOperation),
    sourceType,
    sourceLabel: String(
      job?.fileName ?? job?.sourceUri ?? o.sourceLabel ?? "Nguồn tri thức",
    ),
    createdAt: iso(o.createdAt) ?? new Date().toISOString(),
    reviewedAt: iso(o.reviewedAt) ?? null,
  };
}

export function mapMcpSuite(raw: unknown): McpUiSuite {
  const o = asRecord(raw) ?? {};
  const connectors = asArray(o.connectors).map((c) => {
    const r = asRecord(c) ?? {};
    return {
      capability: String(r.capability ?? "los") as McpUiSuite["connectors"][0]["capability"],
      serverName: String(r.serverName ?? ""),
      implementation:
        r.implementation === "real" ? ("real" as const) : ("stub" as const),
      enabled: r.enabled !== false,
      status:
        r.enabled === false ? ("disabled" as const) : ("enabled" as const),
      tools: asArray(r.tools).map((t) => {
        const tr = asRecord(t) ?? {};
        return {
          name: String(tr.name ?? ""),
          mutates: tr.mutates === true,
        };
      }),
    };
  });
  return {
    suite: String(o.suite ?? "SHB MCP Suite"),
    bankCode: String(o.bankCode ?? "SHB"),
    connected: o.connected !== false,
    connectorCount:
      typeof o.connectorCount === "number"
        ? o.connectorCount
        : connectors.length,
    enabledCount:
      typeof o.enabledCount === "number"
        ? o.enabledCount
        : connectors.filter((c) => c.enabled).length,
    connectors,
  };
}

export function mapAuditEvent(raw: unknown): AuditUiEvent {
  const o = asRecord(raw) ?? {};
  return {
    id: String(o.id ?? ""),
    actorId: String(o.actorId ?? ""),
    action: String(o.action ?? ""),
    resource: String(o.resource ?? ""),
    detailJson: asRecord(o.detailJson) ?? null,
    createdAt: iso(o.createdAt) ?? new Date().toISOString(),
  };
}
