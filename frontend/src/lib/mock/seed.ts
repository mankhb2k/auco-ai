import type {
  Automation,
  AutomationRun,
  CompareMetrics,
  Customer,
  CustomerPortfolio,
  Employee,
  McpSuiteStatus,
  TaskRun,
} from "@/lib/types/domain";
import customersJson from "@/lib/mock/customers.json";
import { SCENARIO_PRESETS, DEFAULT_SCENARIO } from "@/lib/mock/scenarios";
import { emptyUsageSummary, makeUsage } from "@/lib/mock/usage";

export { SCENARIO_PRESETS, DEFAULT_SCENARIO };

export const DEMO_GOAL =
  SCENARIO_PRESETS.find((p) => p.id === DEFAULT_SCENARIO)?.goal ??
  SCENARIO_PRESETS[0].goal;

export const employees: Employee[] = [
  {
    id: "emp-credit-b",
    bankCode: "SHB",
    displayName: "Nguyễn Thị B — Chuyên viên Tín dụng",
    role: "credit_officer",
    branchCode: "CN_CAU_GIAY",
  },
  {
    id: "emp-ops-c",
    bankCode: "SHB",
    displayName: "Trần Văn C — Nhân viên Vận hành",
    role: "ops_officer",
    branchCode: "CN_CAU_GIAY",
  },
  {
    id: "emp-mgr-d",
    bankCode: "SHB",
    displayName: "Lê Minh D — Giám đốc chi nhánh",
    role: "branch_manager",
    branchCode: "CN_CAU_GIAY",
  },
];

/** Full demo customer catalog (24 records). */
export const customerCatalog = customersJson.customers;

export const customers: Customer[] = customerCatalog.map((c) => ({
  id: c.id,
  bankCode: c.bankCode,
  fullName: c.fullName,
  customerNo: c.customerNo,
  branchCode: c.branchCode,
}));

/** Portfolio của nhân viên CN Cầu Giấy — không gồm KH Hà Đông (cus-004, cus-022). */
export const portfolios: CustomerPortfolio[] = customerCatalog
  .filter((c) => c.branchCode === "CN_CAU_GIAY")
  .flatMap((c) => [
    { employeeId: "emp-credit-b", customerId: c.id },
    { employeeId: "emp-ops-c", customerId: c.id },
  ]);

export function findCustomerByDemoTag(tag: string) {
  return customerCatalog.find((c) => c.demoTag === tag);
}

export const mcpSuite: McpSuiteStatus = {
  suite: "SHB MCP Suite",
  connected: true,
  connectors: [
    { id: "mcp-los", name: "LOS", status: "connected", lastTool: "check_loan_eligibility" },
    { id: "mcp-compliance", name: "Compliance", status: "connected", lastTool: "run_aml_check" },
    { id: "mcp-core-banking", name: "Core Banking", status: "mock" },
    { id: "mcp-product", name: "Product", status: "mock", lastTool: "compare_products" },
    { id: "mcp-ops", name: "Ops", status: "mock" },
  ],
};

export const seedAutomations: Automation[] = [
  {
    id: "auto-monthly-risk",
    name: "Báo cáo rủi ro tín dụng tháng",
    description:
      "Mỗi ngày 1 hàng tháng 08:00 — trích xuất KH/giao dịch tháng trước, tóm tắt rủi ro, gửi thông báo.",
    createdByAgentRole: "credit",
    triggerType: "schedule",
    cronExpr: "0 8 1 * *",
    timezone: "Asia/Ho_Chi_Minh",
    enabled: false,
    status: "pending_approval",
    nextRunAt: "2026-08-01T08:00:00+07:00",
    createdAt: "2026-07-10T09:00:00+07:00",
  },
];

export const seedAutomationRuns: AutomationRun[] = [
  {
    id: "arun-1",
    automationId: "auto-monthly-risk",
    status: "done",
    startedAt: "2026-07-01T08:00:12+07:00",
    finishedAt: "2026-07-01T08:01:04+07:00",
    resultSummary: "Dry-run: 128 KH trong danh mục, 3 cảnh báo rủi ro trung bình.",
  },
];

export const compareByMode: Record<"multi" | "single", CompareMetrics> = {
  multi: {
    mode: "multi",
    latencyMs: 18400,
    toolAccuracy: 0.94,
    citationCount: 5,
    realActions: 1,
    totalTokens: 12480,
    costUsd: 0.0142,
    notes: [
      "Planner chia Credit ‖ Legal → Product",
      "Tool đúng domain qua allowlist",
      "Side-effect qua Approval · log token/cost đầy đủ",
    ],
  },
  single: {
    mode: "single",
    latencyMs: 9200,
    toolAccuracy: 0.61,
    citationCount: 1,
    realActions: 0,
    totalTokens: 4100,
    costUsd: 0.0051,
    notes: [
      "1 agent full tool — dễ gọi sai domain",
      "Ít citation / dễ bịa",
      "Rẻ token hơn nhưng thiếu audit cộng tác",
    ],
  },
};

/** Snapshot lịch sử mẫu (đã hoàn tất trước đó). */
export function buildHistorySample(): TaskRun {
  const stepUsage = makeUsage({
    promptTokens: 900,
    completionTokens: 320,
    latencyMs: 700,
  });
  return {
    id: "tr-history-1",
    bankCode: "SHB",
    employeeId: "emp-credit-b",
    goal: "Kiểm tra nhanh hạn mức thẻ tín dụng của Ngô Thanh Mai (SHB-KH-1010)",
    status: "done",
    mode: "multi",
    scenario: "home",
    planJson: { summary: "Triage 1 step — Credit Agent" },
    finalAnswer:
      "Hạn mức hiện tại 80 triệu VND, dư nợ 12 triệu. Không phát hiện cảnh báo tuân thủ.",
    citations: [
      {
        sourceDoc: "SHB-The-Tin-Dung-2024.pdf",
        section: "2.1 Hạn mức",
        score: 0.88,
      },
    ],
    usage: {
      ...emptyUsageSummary(),
      promptTokens: 900,
      completionTokens: 320,
      totalTokens: 1220,
      costUsd: stepUsage.costUsd,
      wallClockMs: 8200,
      events: [
        {
          id: "ue-hist-1",
          at: "2026-07-15T10:20:02+07:00",
          kind: "llm_specialist",
          agentRole: "credit",
          stepId: "hist-s1",
          label: "Credit · tra cứu hạn mức thẻ",
          usage: stepUsage,
        },
      ],
    },
    createdAt: "2026-07-15T10:20:00+07:00",
    steps: [
      {
        id: "hist-s1",
        taskRunId: "tr-history-1",
        agentRole: "credit",
        mode: "direct",
        label: "Tra cứu hạn mức thẻ",
        input: { customerId: "cus-010" },
        output: { limit: 80_000_000, outstanding: 12_000_000 },
        status: "done",
        dependsOn: [],
        toolCalls: [
          {
            id: "tc-h1",
            tool: "get_credit_score",
            mcp: "mcp-core-banking",
            mutates: false,
            input: { customerId: "cus-010" },
            output: { score: 720 },
            latencyMs: 420,
          },
        ],
        citations: [],
        usage: stepUsage,
        startedAt: "2026-07-15T10:20:01+07:00",
        finishedAt: "2026-07-15T10:20:08+07:00",
      },
    ],
  };
}
