import { imfFxTrend } from "@/lib/mock/imf";
import { knowledgeDocuments, ltvConflict } from "@/lib/mock/knowledge";
import { detectScenario } from "@/lib/mock/scenarios";
import {
  emptyUsageSummary,
  makeUsage,
  mergeUsage,
} from "@/lib/mock/usage";
import type {
  OrchestrationMode,
  RagCitation,
  ScenarioId,
  TaskRun,
  TaskStep,
  ToolCallRecord,
  UsageEvent,
} from "@/lib/types/domain";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function activeDoc(docId: string) {
  return knowledgeDocuments.find((d) => d.id === docId)!;
}

type Listener = (run: TaskRun) => void;

function buildMultiSteps(
  taskRunId: string,
  scenario: ScenarioId,
  outOfPortfolio: boolean,
): TaskStep[] {
  const creditId = id("step");
  const legalId = id("step");
  const productId = id("step");

  const configs: Record<
    ScenarioId,
    {
      creditLabel: string;
      creditInput: Record<string, unknown>;
      creditWorkers: string[];
      legalLabel: string;
      productLabel: string;
      productInput: Record<string, unknown>;
      approvalPreview: string;
    }
  > = {
    corporate: {
      creditLabel: "Đánh giá hạn mức DN · BCTC / DTI / LTV",
      creditInput: {
        customerId: "cus-002",
        amount: 50_000_000_000,
        purpose: "mo_rong_nha_may",
      },
      creditWorkers: [
        "Worker · BCTC & vốn tự có",
        "Worker · LTV nhà xưởng",
        "Worker · CIC doanh nghiệp",
      ],
      legalLabel: "Đối chiếu Thông tư 39 vs quy trình nội bộ",
      productLabel: "Đề xuất sản phẩm vay DN / hạn mức",
      productInput: { amount: 40_000_000_000, segment: "sme" },
      approvalPreview:
        "Dry-run: submit_loan_application + chuẩn bị giải ngân 40 tỷ (mutates) — hồ sơ CT TNHH SHB Mekong.",
    },
    fx: {
      creditLabel: "Đánh giá vay/đổi ngoại tệ · rủi ro tỷ giá",
      creditInput: {
        customerId: "cus-003",
        amountUsd: 150_000,
        purpose: "fx_conversion",
      },
      creditWorkers: [
        "Worker · năng lực trả nợ",
        "Worker · xu hướng FX macro",
        "Worker · CIC cá nhân",
      ],
      legalLabel: "AML/KYC + khuyến nghị mục đích vốn FX",
      productLabel: "Đề xuất sản phẩm vay/đổi ngoại tệ",
      productInput: { currency: "USD" },
      approvalPreview:
        "Dry-run: flag_transaction (mutates) — đánh dấu giao dịch FX lớn cần giám sát thêm.",
    },
    home: {
      creditLabel: "Đánh giá điều kiện tín dụng vay mua nhà",
      creditInput: {
        customerId: outOfPortfolio ? "cus-004" : "cus-001",
        amount: 2_000_000_000,
        purpose: "mua_nha",
      },
      creditWorkers: [
        "Worker · thu nhập / DTI",
        "Worker · tài sản đảm bảo",
        "Worker · lịch sử tín dụng",
      ],
      legalLabel: "Kiểm tra AML / tuân thủ",
      productLabel: "Đề xuất sản phẩm vay mua nhà",
      productInput: { amount: 2_000_000_000 },
      approvalPreview: outOfPortfolio
        ? "Nhân viên xin truy cập KH ngoài danh mục (SHB-KH-1004 · Lê Minh Cường · CN Hà Đông)."
        : "Dry-run: submit_loan_application — tạo hồ sơ vay mua nhà 2 tỷ cho Nguyễn Văn An (mutates).",
    },
  };

  const c = configs[scenario];

  return [
    {
      id: creditId,
      taskRunId,
      agentRole: "credit",
      mode: "spawn_workers",
      label: c.creditLabel,
      input: c.creditInput,
      status: "pending",
      dependsOn: [],
      toolCalls: [],
      citations: [],
      workers: c.creditWorkers.map((label) => ({
        id: id("w"),
        label,
        status: "pending" as const,
      })),
      approvalReason: outOfPortfolio ? "out_of_portfolio_access" : undefined,
      approvalPreview: c.approvalPreview,
    },
    {
      id: legalId,
      taskRunId,
      agentRole: "legal",
      mode: "direct",
      label: c.legalLabel,
      input: { scenario },
      status: "pending",
      dependsOn: [],
      toolCalls: [],
      citations: [],
    },
    {
      id: productId,
      taskRunId,
      agentRole: "product",
      mode: "direct",
      label: c.productLabel,
      input: c.productInput,
      status: "pending",
      dependsOn: [creditId, legalId],
      toolCalls: [],
      citations: [],
    },
  ];
}

function buildSingleSteps(taskRunId: string, scenario: ScenarioId): TaskStep[] {
  return [
    {
      id: id("step"),
      taskRunId,
      agentRole: "credit",
      mode: "direct",
      label: "Single-agent · xử lý toàn bộ yêu cầu",
      input: { scenario },
      status: "pending",
      dependsOn: [],
      toolCalls: [],
      citations: [],
    },
  ];
}

export function createTaskRun(params: {
  goal: string;
  employeeId: string;
  mode: OrchestrationMode;
  scenario?: ScenarioId;
  outOfPortfolio?: boolean;
}): TaskRun {
  const runId = id("tr");
  const scenario = params.scenario ?? detectScenario(params.goal);
  const outOfPortfolio = Boolean(params.outOfPortfolio);
  const steps =
    params.mode === "multi"
      ? buildMultiSteps(runId, scenario, outOfPortfolio)
      : buildSingleSteps(runId, scenario);

  const summaries: Record<ScenarioId, string> = {
    corporate: "DAG ghim: Credit ‖ Legal → Product · DN 50 tỷ / TT39",
    fx: "DAG ghim: Credit ‖ Legal → Product · cảnh báo FX/IMF",
    home: "DAG ghim: Credit ‖ Legal → Product · vay mua nhà",
  };

  return {
    id: runId,
    bankCode: "SHB",
    employeeId: params.employeeId,
    goal: params.goal,
    status: "planning",
    mode: params.mode,
    scenario,
    planJson: {
      summary:
        params.mode === "multi"
          ? summaries[scenario]
          : "Baseline single-agent — không Planner",
    },
    citations: [],
    usage: emptyUsageSummary(),
    createdAt: nowIso(),
    steps,
  };
}

export class TaskRunSimulator {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private run: TaskRun;
  private listener: Listener;
  private outOfPortfolio: boolean;
  private startedAtMs: number;

  constructor(run: TaskRun, listener: Listener, outOfPortfolio = false) {
    this.run = structuredClone(run);
    this.listener = listener;
    this.outOfPortfolio = outOfPortfolio;
    this.startedAtMs = Date.now();
  }

  start() {
    this.emit();
    this.schedule(300, () => {
      this.logUsage({
        kind: "llm_plan",
        agentRole: "planner",
        label: "Planner · generateObject TaskPlan",
        usage: makeUsage({
          promptTokens: 1200,
          completionTokens: 480,
          latencyMs: 620,
        }),
      });
      this.run.status = "running";
      this.emit();
    });

    if (this.run.mode === "single") {
      this.simulateSingle();
      return;
    }
    this.simulateMulti();
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  approve(stepId: string) {
    const step = this.run.steps.find((s) => s.id === stepId);
    if (!step || step.status !== "waiting_approval") return;
    step.status = "done";
    step.finishedAt = nowIso();

    const mutateTool =
      this.run.scenario === "fx"
        ? {
            tool: "flag_transaction",
            mcp: "mcp-compliance",
            output: { flagged: true, reason: "large_fx" },
          }
        : this.outOfPortfolio
          ? {
              tool: "get_customer_profile",
              mcp: "mcp-core-banking",
              output: { ok: true, access: "granted" },
            }
          : {
              tool: "submit_loan_application",
              mcp: "mcp-los",
              output: {
                ok: true,
                applicationId: `LOS-${Date.now().toString().slice(-6)}`,
                disbursePrep: this.run.scenario === "corporate" ? "40_000_000_000" : true,
              },
            };

    step.toolCalls.push({
      id: id("tc"),
      tool: mutateTool.tool,
      mcp: mutateTool.mcp,
      mutates: true,
      input: step.input,
      output: mutateTool.output,
      latencyMs: 310,
    });
    step.output = {
      approved: true,
      action: mutateTool.tool,
      opsNote:
        this.run.scenario === "corporate"
          ? "Ops: mã hồ sơ đã tạo, sẵn sàng giải ngân sau khi kế toán xác nhận."
          : "Side-effect đã thực thi trên mock MCP.",
    };
    this.logUsage({
      kind: "tool",
      agentRole: step.agentRole,
      stepId: step.id,
      label: `Tool mutate · ${mutateTool.tool}`,
      usage: makeUsage({ promptTokens: 0, completionTokens: 0, latencyMs: 310 }),
    });
    this.emit();
    this.maybeFinishOrContinue();
  }

  reject(stepId: string) {
    const step = this.run.steps.find((s) => s.id === stepId);
    if (!step || step.status !== "waiting_approval") return;
    step.status = "failed";
    step.finishedAt = nowIso();
    step.output = { approved: false, reason: "user_rejected" };
    this.run.status = "failed";
    this.run.usage.wallClockMs = Date.now() - this.startedAtMs;
    this.run.finalAnswer =
      "Yêu cầu dừng vì hành động side-effect bị từ chối trên Approval panel. Planner điều chỉnh: chưa tạo hồ sơ / chưa giải ngân.";
    this.emit();
    this.stop();
  }

  private simulateMulti() {
    const [credit, legal, product] = this.run.steps;

    this.schedule(700, () => {
      credit.status = "running";
      credit.startedAt = nowIso();
      if (credit.workers) for (const w of credit.workers) w.status = "running";
      legal.status = "running";
      legal.startedAt = nowIso();
      this.emit();
    });

    this.schedule(2000, () => {
      if (credit.workers) {
        credit.workers.forEach((w, i) => {
          w.status = "done";
          w.summary = ["OK", "OK", "OK"][i] ?? "OK";
          this.logUsage({
            kind: "llm_worker",
            agentRole: "credit",
            stepId: credit.id,
            label: w.label,
            usage: makeUsage({
              promptTokens: 400 + i * 80,
              completionTokens: 160 + i * 40,
              latencyMs: 280 + i * 40,
            }),
          });
        });
      }
      credit.toolCalls.push(...this.creditTools());
      credit.citations.push(...this.creditCitations());
      const creditUsage = makeUsage({
        promptTokens: 1800,
        completionTokens: 720,
        latencyMs: 980,
      });
      credit.usage = creditUsage;
      this.logUsage({
        kind: "llm_specialist",
        agentRole: "credit",
        stepId: credit.id,
        label: "Credit · aggregate workers",
        usage: creditUsage,
      });
      credit.output = this.creditOutput();
      credit.status = "waiting_approval";
      credit.approvalReason = this.outOfPortfolio
        ? "out_of_portfolio_access"
        : "mutates";
      this.emit();
    });

    this.schedule(2600, () => {
      legal.toolCalls.push(...this.legalTools());
      legal.citations.push(...this.legalCitations());
      const legalUsage = makeUsage({
        promptTokens: 2100,
        completionTokens: 640,
        latencyMs: 1100,
      });
      legal.usage = legalUsage;
      this.logUsage({
        kind: "llm_specialist",
        agentRole: "legal",
        stepId: legal.id,
        label: "Legal · hybrid RAG + compliance",
        usage: legalUsage,
      });
      this.logUsage({
        kind: "rag",
        agentRole: "legal",
        stepId: legal.id,
        label: "RAG retrieval · knowledge lite",
        usage: makeUsage({
          promptTokens: 600,
          completionTokens: 0,
          latencyMs: 180,
          model: "embedding-mock",
        }),
      });
      legal.status = "done";
      legal.finishedAt = nowIso();
      legal.output = this.legalOutput();
      this.emit();
      this.tryStartProduct(product);
    });
  }

  private simulateSingle() {
    const [step] = this.run.steps;
    this.schedule(600, () => {
      step.status = "running";
      step.startedAt = nowIso();
      this.emit();
    });
    this.schedule(2400, () => {
      step.toolCalls.push({
        id: id("tc"),
        tool: "list_products",
        mcp: "mcp-product",
        mutates: false,
        input: {},
        output: { count: 3 },
        latencyMs: 400,
      });
      const u = makeUsage({
        promptTokens: 3200,
        completionTokens: 900,
        latencyMs: 1400,
      });
      step.usage = u;
      this.logUsage({
        kind: "llm_specialist",
        agentRole: "credit",
        stepId: step.id,
        label: "Single-agent · full tool dump",
        usage: u,
      });
      step.status = "done";
      step.finishedAt = nowIso();
      step.output = { summary: "Trả lời gộp — thiếu tách domain & audit." };
      this.run.status = "done";
      this.run.usage.wallClockMs = Date.now() - this.startedAtMs;
      this.run.finalAnswer =
        "Baseline single-agent: trả lời nhanh hơn nhưng thiếu tách Credit/Legal/Product, citation mỏng, và không có side-effect có Approval. Bật Multi-agent để so sánh đầy đủ.";
      this.run.citations = this.legalCitations().slice(0, 1);
      this.emit();
    });
  }

  private tryStartProduct(product: TaskStep) {
    const depsDone = product.dependsOn.every((depId) => {
      const dep = this.run.steps.find((s) => s.id === depId);
      return dep?.status === "done";
    });
    if (!depsDone) return;

    this.schedule(400, () => {
      product.status = "running";
      product.startedAt = nowIso();
      this.emit();
    });
    this.schedule(1600, () => {
      product.toolCalls.push(...this.productTools());
      product.citations.push(...this.productCitations());
      const u = makeUsage({
        promptTokens: 1400,
        completionTokens: 520,
        latencyMs: 760,
      });
      product.usage = u;
      this.logUsage({
        kind: "llm_specialist",
        agentRole: "product",
        stepId: product.id,
        label: "Product · đề xuất sản phẩm",
        usage: u,
      });
      product.status = "done";
      product.finishedAt = nowIso();
      product.output = this.productOutput();
      this.emit();
      this.finishIfReady();
    });
  }

  private maybeFinishOrContinue() {
    const product = this.run.steps.find((s) => s.agentRole === "product");
    if (!product) {
      this.finishIfReady();
      return;
    }
    if (product.status === "pending") {
      this.tryStartProduct(product);
      return;
    }
    this.finishIfReady();
  }

  private finishIfReady() {
    const allTerminal = this.run.steps.every(
      (s) => s.status === "done" || s.status === "failed",
    );
    const anyFailed = this.run.steps.some((s) => s.status === "failed");
    const anyWaiting = this.run.steps.some(
      (s) => s.status === "waiting_approval",
    );
    if (anyWaiting || !allTerminal) return;

    if (anyFailed) {
      this.run.status = "failed";
      this.run.usage.wallClockMs = Date.now() - this.startedAtMs;
      this.emit();
      return;
    }

    this.schedule(500, () => {
      const synth = makeUsage({
        promptTokens: 1600,
        completionTokens: 700,
        latencyMs: 820,
      });
      this.logUsage({
        kind: "llm_synthesize",
        agentRole: "planner",
        label: "Planner · synthesize final answer",
        usage: synth,
      });
      this.run.status = "done";
      this.run.usage.wallClockMs = Date.now() - this.startedAtMs;
      this.run.citations = this.finalCitations();
      this.run.finalAnswer = this.finalAnswer();
      this.emit();
    });
  }

  private creditTools(): ToolCallRecord[] {
    const s = this.run.scenario;
    if (s === "corporate") {
      return [
        {
          id: id("tc"),
          tool: "get_financials",
          mcp: "mcp-core-banking",
          mutates: false,
          input: { customerId: "cus-002" },
          output: {
            equity: 52_000_000_000,
            revenue: 8_500_000_000,
            dti: 0.41,
          },
          latencyMs: 420,
        },
        {
          id: id("tc"),
          tool: "check_loan_eligibility",
          mcp: "mcp-los",
          mutates: false,
          input: { amount: 50_000_000_000 },
          output: {
            eligible: false,
            maxSuggested: 40_000_000_000,
            reason: "equity_constraint",
            ltv: 0.72,
          },
          latencyMs: 560,
        },
      ];
    }
    if (s === "fx") {
      return [
        {
          id: id("tc"),
          tool: "get_credit_score",
          mcp: "mcp-core-banking",
          mutates: false,
          input: { customerId: "cus-003" },
          output: { score: 710, cicGroup: 1 },
          latencyMs: 380,
        },
        {
          id: id("tc"),
          tool: "get_macro_fx_trend",
          mcp: "mcp-product",
          mutates: false,
          input: { source: "IMF" },
          output: imfFxTrend,
          latencyMs: 290,
        },
      ];
    }
    return [
      {
        id: id("tc"),
        tool: "get_credit_score",
        mcp: "mcp-core-banking",
        mutates: false,
        input: { customerId: this.outOfPortfolio ? "cus-004" : "cus-001" },
        output: { score: 745, cicGroup: 1, dti: 0.32, ltv: 0.65 },
        latencyMs: 390,
      },
      {
        id: id("tc"),
        tool: "check_loan_eligibility",
        mcp: "mcp-los",
        mutates: false,
        input: { amount: 2_000_000_000 },
        output: { eligible: true, dti: 0.32 },
        latencyMs: 520,
      },
    ];
  }

  private creditCitations(): RagCitation[] {
    if (this.run.scenario === "corporate") {
      const d = activeDoc("doc-shb-dti");
      return [{ sourceDoc: d.title, section: d.section, score: 0.89 }];
    }
    if (this.run.scenario === "fx") {
      return [
        {
          sourceDoc: imfFxTrend.source,
          section: imfFxTrend.metric,
          score: 0.86,
        },
      ];
    }
    const d = activeDoc("doc-shb-dti");
    return [{ sourceDoc: d.title, section: d.section, score: 0.87 }];
  }

  private creditOutput(): Record<string, unknown> {
    if (this.run.scenario === "corporate") {
      return {
        requested: 50_000_000_000,
        maxLimit: 40_000_000_000,
        dti: 0.41,
        ltv: 0.72,
        kri: ["equity_below_request"],
        note: "Vốn tự có chưa đáp ứng 50 tỷ → đề xuất hạn mức 40 tỷ.",
      };
    }
    if (this.run.scenario === "fx") {
      return {
        fxRisk: "elevated",
        householdFxTrend: imfFxTrend.currentPct,
        warning: imfFxTrend.insight,
      };
    }
    return { eligible: true, dti: 0.32, ltv: 0.65, amount: 2_000_000_000 };
  }

  private legalTools(): ToolCallRecord[] {
    if (this.run.scenario === "corporate") {
      return [
        {
          id: id("tc"),
          tool: "search_regulation",
          mcp: "mcp-compliance",
          mutates: false,
          input: { query: "Thông tư 39 LTV nhà xưởng" },
          output: {
            hits: [
              { id: "doc-tt39", ltv: 80 },
              { id: "doc-shb-td-v2", ltv: 75, amends: "doc-shb-td-v1" },
            ],
            conflict: ltvConflict,
          },
          latencyMs: 640,
        },
        {
          id: id("tc"),
          tool: "run_aml_check",
          mcp: "mcp-compliance",
          mutates: false,
          input: { customerId: "cus-002" },
          output: { risk: "low", flags: [] },
          latencyMs: 510,
        },
      ];
    }
    if (this.run.scenario === "fx") {
      return [
        {
          id: id("tc"),
          tool: "run_aml_check",
          mcp: "mcp-compliance",
          mutates: false,
          input: { customerId: "cus-003", largeFx: true },
          output: { risk: "medium", flags: ["large_fx_intent"] },
          latencyMs: 600,
        },
        {
          id: id("tc"),
          tool: "search_regulation",
          mcp: "mcp-compliance",
          mutates: false,
          input: { query: "giao dịch ngoại tệ hộ gia đình" },
          output: { hits: 2, recommendation: imfFxTrend.recommendation },
          latencyMs: 480,
        },
      ];
    }
    return [
      {
        id: id("tc"),
        tool: "run_aml_check",
        mcp: "mcp-compliance",
        mutates: false,
        input: { customerId: "cus-001" },
        output: { risk: "low", flags: [] },
        latencyMs: 680,
      },
      {
        id: id("tc"),
        tool: "search_regulation",
        mcp: "mcp-compliance",
        mutates: false,
        input: { query: "AML vay mua nhà" },
        output: { hits: 2 },
        latencyMs: 540,
      },
    ];
  }

  private legalCitations(): RagCitation[] {
    if (this.run.scenario === "corporate") {
      const tt = activeDoc("doc-tt39");
      const shb = activeDoc("doc-shb-td-v2");
      return [
        { sourceDoc: tt.title, section: tt.section, score: 0.93 },
        { sourceDoc: shb.title, section: shb.section, score: 0.91 },
      ];
    }
    if (this.run.scenario === "fx") {
      const aml = activeDoc("doc-aml");
      return [
        { sourceDoc: aml.title, section: aml.section, score: 0.9 },
        {
          sourceDoc: imfFxTrend.source,
          section: "FX household trend",
          score: 0.85,
        },
      ];
    }
    const aml = activeDoc("doc-aml");
    return [{ sourceDoc: aml.title, section: aml.section, score: 0.91 }];
  }

  private legalOutput(): Record<string, unknown> {
    if (this.run.scenario === "corporate") {
      return {
        compliance: "conditional_pass",
        conflict: ltvConflict,
        note: "Áp dụng LTV nội bộ 75% (bản active sau amends). Cần phê duyệt đặc biệt nếu muốn tiệm cận 80% theo TT39.",
      };
    }
    if (this.run.scenario === "fx") {
      return {
        compliance: "pass_with_warning",
        recommendation: imfFxTrend.recommendation,
      };
    }
    return { aml: "pass", notes: "Không phát hiện cảnh báo." };
  }

  private productTools(): ToolCallRecord[] {
    if (this.run.scenario === "corporate") {
      return [
        {
          id: id("tc"),
          tool: "compare_products",
          mcp: "mcp-product",
          mutates: false,
          input: { amount: 40_000_000_000, segment: "sme" },
          output: {
            best: "Vay trung dài hạn DN — mở rộng sản xuất",
            limit: 40_000_000_000,
          },
          latencyMs: 500,
        },
      ];
    }
    if (this.run.scenario === "fx") {
      return [
        {
          id: id("tc"),
          tool: "compare_products",
          mcp: "mcp-product",
          mutates: false,
          input: { currency: "USD" },
          output: {
            best: "Vay ngắn hạn có bảo đảm · hạn chế FX dài hạn",
            caution: true,
          },
          latencyMs: 470,
        },
      ];
    }
    return [
      {
        id: id("tc"),
        tool: "compare_products",
        mcp: "mcp-product",
        mutates: false,
        input: { amount: 2_000_000_000 },
        output: { best: "Vay mua nhà lãi suất cố định 12 tháng" },
        latencyMs: 510,
      },
    ];
  }

  private productCitations(): RagCitation[] {
    return [
      {
        sourceDoc: "SHB-San-Pham-Tin-Dung.pdf",
        section:
          this.run.scenario === "corporate"
            ? "Vay DN trung dài hạn"
            : this.run.scenario === "fx"
              ? "Sản phẩm ngoại tệ"
              : "Vay mua nhà cố định",
        score: 0.84,
      },
    ];
  }

  private productOutput(): Record<string, unknown> {
    if (this.run.scenario === "corporate") {
      return {
        product: "Vay trung dài hạn DN",
        suggestedLimit: 40_000_000_000,
        reason: "Khớp vốn tự có + LTV nội bộ 75%",
      };
    }
    if (this.run.scenario === "fx") {
      return {
        product: "Vay ngắn hạn có TSĐB",
        reason: "Tránh vay FX dài hạn khi xu hướng tích trữ ngoại tệ tăng",
      };
    }
    return {
      product: "Vay mua nhà lãi suất cố định",
      reason: "Khớp thu nhập + tài sản đảm bảo",
    };
  }

  private finalCitations(): RagCitation[] {
    return [...this.creditCitations(), ...this.legalCitations(), ...this.productCitations()];
  }

  private finalAnswer(): string {
    if (this.run.scenario === "corporate") {
      return [
        "Tổng hợp Planner — CT TNHH Sản xuất SHB Mekong (SHB-KH-1002):",
        "• Hạn mức tối đa đề xuất: 40 tỷ VND (yêu cầu 50 tỷ vượt ràng buộc vốn tự có).",
        `• Tuân thủ: ${ltvConflict.message}`,
        "• Sản phẩm: Vay trung dài hạn DN — mở rộng sản xuất.",
        "• Sau Approval: hồ sơ LOS đã tạo, Ops sẵn sàng bước giải ngân mock.",
      ].join("\n");
    }
    if (this.run.scenario === "fx") {
      return [
        "Tổng hợp Planner — Trần Thị Bình (SHB-KH-1003):",
        `• Macro IMF: nắm giữ FX hộ gia đình tăng từ ${imfFxTrend.decadeAgoPct}% → ${imfFxTrend.currentPct}% (xu hướng EM).`,
        `• ${imfFxTrend.recommendation}`,
        "• Sản phẩm khuyến nghị: vay ngắn hạn có bảo đảm; tránh FX dài hạn.",
        "• Giao dịch lớn đã gắn flag giám sát sau khi được duyệt.",
      ].join("\n");
    }
    return [
      "Tổng hợp Planner — Nguyễn Văn An (SHB-KH-1001):",
      "• Đủ điều kiện vay mua nhà 2 tỷ (DTI/LTV trong ngưỡng).",
      "• AML/tuân thủ đạt.",
      "• Sản phẩm: Vay mua nhà lãi suất cố định.",
      "• Hồ sơ đã được duyệt tạo trên LOS (mock).",
    ].join("\n");
  }

  private logUsage(event: Omit<UsageEvent, "id" | "at">) {
    this.run.usage = mergeUsage(this.run.usage, event);
  }

  private schedule(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private emit() {
    this.run.usage.wallClockMs = Date.now() - this.startedAtMs;
    this.listener(structuredClone(this.run));
  }
}
