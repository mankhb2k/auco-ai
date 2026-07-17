import type {
  OrchestrationMode,
  RagCitation,
  TaskRun,
  TaskStep,
  ToolCallRecord,
} from "@/lib/types/domain";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

const FINAL_CITATIONS: RagCitation[] = [
  {
    sourceDoc: "SBV-4889-AML.pdf",
    section: "Điều 8 — Nhận biết khách hàng",
    score: 0.91,
  },
  {
    sourceDoc: "SHB-Vay-Mua-Nha-2025.pdf",
    section: "3.2 Điều kiện thu nhập",
    score: 0.87,
  },
  {
    sourceDoc: "SHB-San-Pham-Tin-Dung.pdf",
    section: "Vay mua nhà cố định",
    score: 0.84,
  },
];

function buildMultiSteps(taskRunId: string, outOfPortfolio: boolean): TaskStep[] {
  const creditId = id("step");
  const legalId = id("step");
  const productId = id("step");

  return [
    {
      id: creditId,
      taskRunId,
      agentRole: "credit",
      mode: "spawn_workers",
      label: "Đánh giá điều kiện tín dụng",
      input: { amount: 2_000_000_000, purpose: "mua_nha" },
      status: "pending",
      dependsOn: [],
      toolCalls: [],
      citations: [],
      workers: [
        { id: id("w"), label: "Worker · thu nhập", status: "pending" },
        { id: id("w"), label: "Worker · tài sản đảm bảo", status: "pending" },
        { id: id("w"), label: "Worker · lịch sử tín dụng", status: "pending" },
      ],
      approvalReason: outOfPortfolio ? "out_of_portfolio_access" : undefined,
      approvalPreview: outOfPortfolio
        ? "Nhân viên xin truy cập KH ngoài danh mục được giao (SHB-KH-9999)."
        : "Dry-run: submit_loan_application — tạo hồ sơ vay mua nhà 2 tỷ (mutates).",
    },
    {
      id: legalId,
      taskRunId,
      agentRole: "legal",
      mode: "direct",
      label: "Kiểm tra AML / tuân thủ",
      input: { checks: ["aml", "kyc"] },
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
      label: "Đề xuất sản phẩm vay phù hợp",
      input: { amount: 2_000_000_000 },
      status: "pending",
      dependsOn: [creditId, legalId],
      toolCalls: [],
      citations: [],
    },
  ];
}

function buildSingleSteps(taskRunId: string): TaskStep[] {
  return [
    {
      id: id("step"),
      taskRunId,
      agentRole: "credit",
      mode: "direct",
      label: "Single-agent · xử lý toàn bộ yêu cầu",
      input: {},
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
  outOfPortfolio?: boolean;
}): TaskRun {
  const runId = id("tr");
  const outOfPortfolio = Boolean(params.outOfPortfolio);
  const steps =
    params.mode === "multi"
      ? buildMultiSteps(runId, outOfPortfolio)
      : buildSingleSteps(runId);

  return {
    id: runId,
    bankCode: "SHB",
    employeeId: params.employeeId,
    goal: params.goal,
    status: "planning",
    mode: params.mode,
    planJson: {
      summary:
        params.mode === "multi"
          ? "DAG ghim: Credit ‖ Legal → Product"
          : "Baseline single-agent — không Planner",
    },
    citations: [],
    createdAt: nowIso(),
    steps,
  };
}

type Listener = (run: TaskRun) => void;

export class TaskRunSimulator {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private run: TaskRun;
  private listener: Listener;
  private outOfPortfolio: boolean;

  constructor(run: TaskRun, listener: Listener, outOfPortfolio = false) {
    this.run = structuredClone(run);
    this.listener = listener;
    this.outOfPortfolio = outOfPortfolio;
  }

  start() {
    this.emit();
    this.schedule(400, () => {
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
    step.output = {
      approved: true,
      action: this.outOfPortfolio ? "portfolio_access_granted" : "loan_application_submitted",
    };
    step.toolCalls.push({
      id: id("tc"),
      tool: this.outOfPortfolio ? "get_customer_profile" : "submit_loan_application",
      mcp: this.outOfPortfolio ? "mcp-core-banking" : "mcp-los",
      mutates: true,
      input: step.input,
      output: { ok: true },
      latencyMs: 310,
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
    this.run.finalAnswer =
      "Yêu cầu dừng vì hành động side-effect bị từ chối trên Approval panel. Planner điều chỉnh: chưa tạo hồ sơ vay.";
    this.emit();
    this.stop();
  }

  private simulateMulti() {
    const [credit, legal, product] = this.run.steps;

    this.schedule(800, () => {
      credit.status = "running";
      credit.startedAt = nowIso();
      if (credit.workers) {
        for (const w of credit.workers) w.status = "running";
      }
      legal.status = "running";
      legal.startedAt = nowIso();
      this.emit();
    });

    this.schedule(2200, () => {
      if (credit.workers) {
        for (const w of credit.workers) {
          w.status = "done";
          w.summary = "OK";
        }
      }
      credit.toolCalls.push(...this.creditTools());
      credit.citations.push({
        sourceDoc: "SHB-Vay-Mua-Nha-2025.pdf",
        section: "3.2 Điều kiện thu nhập",
        score: 0.87,
      });

      // Demo luôn dừng Credit để người thật duyệt (mutate hoặc ngoài portfolio)
      credit.status = "waiting_approval";
      credit.approvalReason = this.outOfPortfolio
        ? "out_of_portfolio_access"
        : "mutates";
      if (!credit.approvalPreview) {
        credit.approvalPreview =
          "Dry-run: submit_loan_application — tạo hồ sơ vay mua nhà 2 tỷ (mutates).";
      }
      this.emit();
    });

    this.schedule(2600, () => {
      legal.toolCalls.push({
        id: id("tc"),
        tool: "run_aml_check",
        mcp: "mcp-compliance",
        mutates: false,
        input: { customer: "Nguyễn Văn A" },
        output: { risk: "low", flags: [] },
        latencyMs: 680,
      });
      legal.toolCalls.push({
        id: id("tc"),
        tool: "search_regulation",
        mcp: "mcp-compliance",
        mutates: false,
        input: { query: "AML vay mua nhà" },
        output: { hits: 2 },
        latencyMs: 540,
      });
      legal.citations.push({
        sourceDoc: "SBV-4889-AML.pdf",
        section: "Điều 8 — Nhận biết khách hàng",
        score: 0.91,
      });
      legal.status = "done";
      legal.finishedAt = nowIso();
      legal.output = { aml: "pass", notes: "Không phát hiện cảnh báo." };
      this.emit();
      this.tryStartProduct(product);
    });
  }

  private simulateSingle() {
    const [step] = this.run.steps;
    this.schedule(700, () => {
      step.status = "running";
      step.startedAt = nowIso();
      this.emit();
    });
    this.schedule(2800, () => {
      step.toolCalls.push({
        id: id("tc"),
        tool: "list_products",
        mcp: "mcp-product",
        mutates: false,
        input: {},
        output: { count: 3 },
        latencyMs: 400,
      });
      step.status = "done";
      step.finishedAt = nowIso();
      step.output = { summary: "Trả lời gộp — thiếu tách domain." };
      this.run.status = "done";
      this.run.finalAnswer =
        "Baseline single-agent: khách có thể đủ điều kiện vay, nhưng chưa tách kiểm tra AML chuyên sâu và chưa thực thi side-effect có audit. Dùng chế độ Multi-agent để so sánh đầy đủ.";
      this.run.citations = FINAL_CITATIONS.slice(0, 1);
      this.emit();
    });
  }

  private tryStartProduct(product: TaskStep) {
    const depsDone = product.dependsOn.every((depId) => {
      const dep = this.run.steps.find((s) => s.id === depId);
      return dep?.status === "done";
    });
    if (!depsDone) return;

    this.schedule(500, () => {
      product.status = "running";
      product.startedAt = nowIso();
      this.emit();
    });
    this.schedule(1800, () => {
      product.toolCalls.push({
        id: id("tc"),
        tool: "compare_products",
        mcp: "mcp-product",
        mutates: false,
        input: { amount: 2_000_000_000 },
        output: { best: "Vay mua nhà lãi suất cố định 12 tháng" },
        latencyMs: 510,
      });
      product.citations.push({
        sourceDoc: "SHB-San-Pham-Tin-Dung.pdf",
        section: "Vay mua nhà cố định",
        score: 0.84,
      });
      product.status = "done";
      product.finishedAt = nowIso();
      product.output = {
        product: "Vay mua nhà lãi suất cố định",
        reason: "Khớp thu nhập + tài sản đảm bảo",
      };
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
    const anyWaiting = this.run.steps.some((s) => s.status === "waiting_approval");
    if (anyWaiting || !allTerminal) return;

    if (anyFailed) {
      this.run.status = "failed";
      this.emit();
      return;
    }

    this.schedule(600, () => {
      this.run.status = "done";
      this.run.citations = FINAL_CITATIONS;
      this.run.finalAnswer =
        "Tổng hợp Planner: Nguyễn Văn A đủ điều kiện vay mua nhà 2 tỷ. AML/tuân thủ đạt. Sản phẩm phù hợp: Vay mua nhà lãi suất cố định. Hồ sơ đã được duyệt tạo trên LOS (mock).";
      this.emit();
    });
  }

  private creditTools(): ToolCallRecord[] {
    return [
      {
        id: id("tc"),
        tool: "get_credit_score",
        mcp: "mcp-core-banking",
        mutates: false,
        input: { customerId: "cus-a" },
        output: { score: 745 },
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

  private schedule(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private emit() {
    this.listener(structuredClone(this.run));
  }
}
