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
  const collateralId = id("step");
  const productId = id("step");

  const configs: Record<
    ScenarioId,
    {
      creditLabel: string;
      creditInput: Record<string, unknown>;
      creditWorkers: string[];
      legalLabel: string;
      collateralLabel: string;
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
      collateralLabel: "Đánh giá nhà xưởng · LTV · hồ sơ bảo đảm",
      productLabel: "Đề xuất sản phẩm vay DN / hạn mức",
      productInput: { amount: 40_000_000_000, segment: "sme" },
      approvalPreview:
        "Chạy thử: submit_loan_application + chuẩn bị giải ngân 40 tỷ (có tác động) — hồ sơ CT TNHH SHB Mekong.",
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
      collateralLabel: "Xác nhận khoản vay tín chấp · không áp dụng TSĐB",
      productLabel: "Đề xuất sản phẩm vay/đổi ngoại tệ",
      productInput: { currency: "USD" },
      approvalPreview:
        "Chạy thử: flag_transaction (có tác động) — đánh dấu giao dịch FX lớn cần giám sát thêm.",
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
      collateralLabel: "Định giá BĐS · LTV · quyền sở hữu",
      productLabel: "Đề xuất sản phẩm vay mua nhà",
      productInput: { amount: 2_000_000_000 },
      approvalPreview: outOfPortfolio
        ? "Nhân viên xin truy cập KH ngoài danh mục (SHB-KH-1004 · Lê Minh Cường · CN Hà Đông)."
        : "Chạy thử: submit_loan_application — tạo hồ sơ vay mua nhà 2 tỷ cho Nguyễn Văn An (có tác động).",
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
      dependsOn: [creditId, legalId, collateralId],
      toolCalls: [],
      citations: [],
    },
    {
      id: collateralId,
      taskRunId,
      agentRole: "collateral",
      mode: "direct",
      label: c.collateralLabel,
      input: c.creditInput,
      status: "pending",
      dependsOn: [],
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
      label: "Một chuyên gia · xử lý toàn bộ yêu cầu",
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
    corporate: "Sơ đồ ghim: Tín dụng ‖ Pháp lý → Sản phẩm · DN 50 tỷ / TT39",
    fx: "Sơ đồ ghim: Tín dụng ‖ Pháp lý → Sản phẩm · cảnh báo FX/IMF",
    home: "Sơ đồ ghim: Tín dụng ‖ Pháp lý → Sản phẩm · vay mua nhà",
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
          : "Đối chứng một chuyên gia — không bộ điều phối",
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
        label: "Điều phối · lập kế hoạch tác vụ",
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
          : "Hành động có tác động hệ thống đã thực thi trên MCP mô phỏng.",
    };
    this.logUsage({
      kind: "tool",
      agentRole: step.agentRole,
      stepId: step.id,
      label: `Công cụ ghi · ${mutateTool.tool}`,
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
      "Yêu cầu dừng vì hành động có tác động hệ thống bị từ chối trên bảng duyệt. Bộ điều phối điều chỉnh: chưa tạo hồ sơ / chưa giải ngân.";
    this.emit();
    this.stop();
  }

  private simulateMulti() {
    const credit = this.run.steps.find((s) => s.agentRole === "credit")!;
    const legal = this.run.steps.find((s) => s.agentRole === "legal")!;
    const collateral = this.run.steps.find(
      (s) => s.agentRole === "collateral",
    )!;
    const product = this.run.steps.find((s) => s.agentRole === "product")!;

    this.schedule(700, () => {
      credit.status = "running";
      credit.startedAt = nowIso();
      if (credit.workers) for (const w of credit.workers) w.status = "running";
      legal.status = "running";
      legal.startedAt = nowIso();
      collateral.status = "running";
      collateral.startedAt = nowIso();
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
        label: "Tín dụng · tổng hợp worker",
        usage: creditUsage,
      });
      credit.output = this.creditOutput();
      credit.assessment = this.creditAssessment();
      credit.status = "waiting_approval";
      credit.approvalReason = this.outOfPortfolio
        ? "out_of_portfolio_access"
        : "mutates";
      this.emit();
    });

    this.schedule(2300, () => {
      collateral.toolCalls.push({
        id: id("tc"),
        tool: "get_collateral_package",
        mcp: "mcp-los",
        mutates: false,
        input: collateral.input,
        output: {
          appraisedValueVnd: 3_200_000_000,
          ltvActual: 62.5,
          appraisalFresh: true,
          ownershipStatus: "valid",
          securityRegistrationStatus: "registered",
        },
        latencyMs: 320,
      });
      collateral.status = "done";
      collateral.finishedAt = nowIso();
      collateral.output = {
        summary: "TSĐB đạt kiểm tra sơ bộ; LTV 62,5%.",
        eligible: true,
        ltvActual: 62.5,
      };
      this.emit();
      this.tryStartProduct(product);
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
        label: "Pháp lý · RAG lai + tuân thủ",
        usage: legalUsage,
      });
      this.logUsage({
        kind: "rag",
        agentRole: "legal",
        stepId: legal.id,
        label: "Truy xuất tri thức · RAG rút gọn",
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
      legal.assessment = this.legalAssessment();
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
        label: "Một chuyên gia · gọi toàn bộ công cụ",
        usage: u,
      });
      step.status = "done";
      step.finishedAt = nowIso();
      step.output = {
        summary: "Trả lời gộp — thiếu tách lĩnh vực và kiểm soát.",
      };
      this.run.status = "done";
      this.run.usage.wallClockMs = Date.now() - this.startedAtMs;
      this.run.finalAnswer =
        "Đối chứng một chuyên gia: trả lời nhanh hơn nhưng thiếu tách Tín dụng/Pháp lý/Sản phẩm, trích dẫn mỏng, và không có duyệt hành động có tác động hệ thống. Bật đa chuyên gia để so sánh đầy đủ.";
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
        label: "Sản phẩm · đề xuất sản phẩm",
        usage: u,
      });
      product.status = "done";
      product.finishedAt = nowIso();
      product.output = this.productOutput();
      product.assessment = this.productAssessment();
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
        label: "Điều phối · tổng hợp câu trả lời",
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

  private creditAssessment(): string {
    if (this.run.scenario === "corporate") {
      return [
        "**Đánh giá chuyên gia Tín dụng**",
        "",
        "Đã phân tích BCTC, DTI và LTV nhà xưởng của CT TNHH Sản xuất SHB Mekong.",
        "",
        "• Yêu cầu vay: **50 tỷ VND**",
        "• Hạn mức tối đa đề xuất: **40 tỷ VND** (vốn tự có chưa đáp ứng đủ 50 tỷ)",
        "• DTI ≈ 41% · LTV ≈ 72%",
        "• KRI: vốn tự có thấp hơn mức yêu cầu",
        "",
        "Khuyến nghị: trình hồ sơ với hạn mức 40 tỷ và chuẩn bị giải ngân sau khi được phê duyệt.",
      ].join("\n");
    }
    if (this.run.scenario === "fx") {
      return [
        "**Đánh giá chuyên gia Tín dụng**",
        "",
        "Khách hàng Trần Thị Bình có nhu cầu vay/đổi ngoại tệ lớn.",
        "",
        `• Xu hướng FX hộ gia đình (IMF): ~${imfFxTrend.currentPct}%`,
        `• ${imfFxTrend.insight}`,
        "",
        "Rủi ro tỷ giá được đánh giá ở mức cao hơn bình thường đối với khoản dài hạn.",
      ].join("\n");
    }
    if (this.outOfPortfolio) {
      return [
        "**Đánh giá chuyên gia Tín dụng**",
        "",
        "Yêu cầu truy cập khách hàng ngoài danh mục được giao (CN Hà Đông).",
        "Cần phê duyệt trước khi tiếp tục tra cứu / tạo hồ sơ.",
      ].join("\n");
    }
    return [
      "**Đánh giá chuyên gia Tín dụng**",
      "",
      "Nguyễn Văn An đủ điều kiện sơ bộ vay mua nhà 2 tỷ.",
      "• DTI ≈ 32% · LTV ≈ 65% · CIC nhóm 1 (Tốt)",
      "",
      "Sẵn sàng tạo hồ sơ LOS sau khi duyệt.",
    ].join("\n");
  }

  private legalAssessment(): string {
    if (this.run.scenario === "corporate") {
      return [
        "**Nhận xét Pháp lý / Tuân thủ**",
        "",
        "Đã đối chiếu Thông tư 39/2016/TT-NHNN với quy trình tín dụng nội bộ SHB (bản đang hiệu lực).",
        "",
        `• ${ltvConflict.message}`,
        "• AML/KYC: đạt (rủi ro thấp)",
        "",
        "Kết luận: **đạt có điều kiện** — áp dụng LTV nội bộ 75%; cần phê duyệt đặc biệt nếu muốn tiệm cận trần 80% của Thông tư.",
      ].join("\n");
    }
    if (this.run.scenario === "fx") {
      return [
        "**Nhận xét Pháp lý / Tuân thủ**",
        "",
        "Giao dịch FX lớn cần KYC/AML tăng cường.",
        `• ${imfFxTrend.recommendation}`,
        "",
        "Kết luận: **đạt kèm cảnh báo** — nên gắn flag giám sát trước khi thực thi.",
      ].join("\n");
    }
    return [
      "**Nhận xét Pháp lý / Tuân thủ**",
      "",
      "AML/KYC đạt. Không phát hiện cảnh báo tuân thủ liên quan khoản vay mua nhà.",
    ].join("\n");
  }

  private productAssessment(): string {
    if (this.run.scenario === "corporate") {
      return [
        "**Đề xuất chuyên gia Sản phẩm**",
        "",
        "Sản phẩm phù hợp: **Vay trung dài hạn DN — mở rộng sản xuất**",
        "Hạn mức gợi ý: **40 tỷ VND**, khớp vốn tự có và LTV nội bộ 75%.",
      ].join("\n");
    }
    if (this.run.scenario === "fx") {
      return [
        "**Đề xuất chuyên gia Sản phẩm**",
        "",
        "Ưu tiên **vay ngắn hạn có tài sản đảm bảo**; hạn chế sản phẩm FX dài hạn trong bối cảnh tích trữ ngoại tệ tăng.",
      ].join("\n");
    }
    return [
      "**Đề xuất chuyên gia Sản phẩm**",
      "",
      "Sản phẩm: **Vay mua nhà lãi suất cố định** — khớp thu nhập và tài sản đảm bảo.",
    ].join("\n");
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
        "Tổng hợp điều phối — CT TNHH Sản xuất SHB Mekong (SHB-KH-1002):",
        "• Hạn mức tối đa đề xuất: 40 tỷ VND (yêu cầu 50 tỷ vượt ràng buộc vốn tự có).",
        `• Tuân thủ: ${ltvConflict.message}`,
        "• Sản phẩm: Vay trung dài hạn DN — mở rộng sản xuất.",
        "• Sau duyệt: hồ sơ LOS đã tạo, Vận hành sẵn sàng bước giải ngân (mô phỏng).",
      ].join("\n");
    }
    if (this.run.scenario === "fx") {
      return [
        "Tổng hợp điều phối — Trần Thị Bình (SHB-KH-1003):",
        `• Macro IMF: nắm giữ FX hộ gia đình tăng từ ${imfFxTrend.decadeAgoPct}% → ${imfFxTrend.currentPct}% (xu hướng EM).`,
        `• ${imfFxTrend.recommendation}`,
        "• Sản phẩm khuyến nghị: vay ngắn hạn có bảo đảm; tránh FX dài hạn.",
        "• Giao dịch lớn đã gắn cờ giám sát sau khi được duyệt.",
      ].join("\n");
    }
    return [
      "Tổng hợp điều phối — Nguyễn Văn An (SHB-KH-1001):",
      "• Đủ điều kiện vay mua nhà 2 tỷ (DTI/LTV trong ngưỡng).",
      "• AML/tuân thủ đạt.",
      "• Sản phẩm: Vay mua nhà lãi suất cố định.",
      "• Hồ sơ đã được duyệt tạo trên LOS (mô phỏng).",
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
