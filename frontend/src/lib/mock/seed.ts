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

export const DEMO_GOAL =
  "Khách hàng Nguyễn Văn A muốn vay 2 tỷ mua nhà, kiểm tra đủ điều kiện tín dụng không, có vướng quy định AML/tuân thủ không, sản phẩm vay nào phù hợp nhất, và tạo hồ sơ vận hành nếu đủ điều kiện.";

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

export const customers: Customer[] = [
  {
    id: "cus-a",
    bankCode: "SHB",
    fullName: "Nguyễn Văn A",
    customerNo: "SHB-KH-1001",
    branchCode: "CN_CAU_GIAY",
  },
  {
    id: "cus-out",
    bankCode: "SHB",
    fullName: "Phạm Thị Ngoài Danh Mục",
    customerNo: "SHB-KH-9999",
    branchCode: "CN_HA_DONG",
  },
];

export const portfolios: CustomerPortfolio[] = [
  { employeeId: "emp-credit-b", customerId: "cus-a" },
  { employeeId: "emp-ops-c", customerId: "cus-a" },
];

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
    notes: [
      "Planner chia Credit ‖ Legal → Product",
      "Tool đúng domain qua allowlist",
      "Side-effect qua Approval",
    ],
  },
  single: {
    mode: "single",
    latencyMs: 9200,
    toolAccuracy: 0.61,
    citationCount: 1,
    realActions: 0,
    notes: [
      "1 agent full tool — dễ gọi sai domain",
      "Ít citation / dễ bịa",
      "Không có DAG cộng tác",
    ],
  },
};

/** Snapshot lịch sử mẫu (đã hoàn tất trước đó). */
export function buildHistorySample(): TaskRun {
  return {
    id: "tr-history-1",
    bankCode: "SHB",
    employeeId: "emp-credit-b",
    goal: "Kiểm tra nhanh hạn mức thẻ tín dụng của Nguyễn Văn A",
    status: "done",
    mode: "multi",
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
    createdAt: "2026-07-15T10:20:00+07:00",
    steps: [
      {
        id: "hist-s1",
        taskRunId: "tr-history-1",
        agentRole: "credit",
        mode: "direct",
        label: "Tra cứu hạn mức thẻ",
        input: { customerId: "cus-a" },
        output: { limit: 80_000_000, outstanding: 12_000_000 },
        status: "done",
        dependsOn: [],
        toolCalls: [
          {
            id: "tc-h1",
            tool: "get_credit_score",
            mcp: "mcp-core-banking",
            mutates: false,
            input: { customerId: "cus-a" },
            output: { score: 720 },
            latencyMs: 420,
          },
        ],
        citations: [],
        startedAt: "2026-07-15T10:20:01+07:00",
        finishedAt: "2026-07-15T10:20:08+07:00",
      },
    ],
  };
}
