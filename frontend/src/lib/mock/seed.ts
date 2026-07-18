import type {
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
    accessLayer: "employee",
    branchCode: "CN_CAU_GIAY",
  },
  {
    id: "emp-credit-f",
    bankCode: "SHB",
    displayName: "Phạm Quốc F — Chuyên viên Tín dụng",
    role: "credit_officer",
    accessLayer: "employee",
    branchCode: "CN_CAU_GIAY",
  },
  {
    id: "emp-credit-g",
    bankCode: "SHB",
    displayName: "Hoàng Mai G — Chuyên viên Tín dụng",
    role: "credit_officer",
    accessLayer: "employee",
    branchCode: "CN_CAU_GIAY",
  },
  {
    id: "emp-ops-c",
    bankCode: "SHB",
    displayName: "Trần Văn C — Nhân viên Vận hành",
    role: "ops_officer",
    accessLayer: "employee",
    branchCode: "CN_CAU_GIAY",
  },
  {
    id: "emp-mgr-d",
    bankCode: "SHB",
    displayName: "Lê Minh D — Giám đốc chi nhánh",
    role: "branch_manager",
    accessLayer: "manager",
    branchCode: "CN_CAU_GIAY",
  },
  {
    id: "emp-it-e",
    bankCode: "SHB",
    displayName: "Trần IT E — Quản trị Platform",
    role: "it_admin",
    accessLayer: "it_admin",
    branchCode: null,
  },
];

export const ACCESS_LAYER_LABEL: Record<
  Employee["accessLayer"],
  string
> = {
  it_admin: "IT / Nền tảng",
  manager: "Giám đốc",
  employee: "Nhân viên",
};

/** Full demo customer catalog (24 records). */
export const customerCatalog = customersJson.customers;

export const customers: Customer[] = customerCatalog.map((c) => ({
  id: c.id,
  bankCode: c.bankCode,
  fullName: c.fullName,
  customerNo: c.customerNo,
  branchCode: c.branchCode,
}));

/** Portfolio CN Cầu Giấy — 3 chuyên viên tín dụng + ops; không gồm KH Hà Đông. */
export const portfolios: CustomerPortfolio[] = customerCatalog
  .filter((c) => c.branchCode === "CN_CAU_GIAY")
  .flatMap((c) => [
    { employeeId: "emp-credit-b", customerId: c.id },
    { employeeId: "emp-credit-f", customerId: c.id },
    { employeeId: "emp-credit-g", customerId: c.id },
    { employeeId: "emp-ops-c", customerId: c.id },
  ]);

export function findCustomerByDemoTag(tag: string) {
  return customerCatalog.find((c) => c.demoTag === tag);
}

export const mcpSuite: McpSuiteStatus = {
  suite: "Bộ kết nối MCP SHB",
  connected: true,
  connectors: [
    { id: "mcp-los", name: "LOS", status: "connected", lastTool: "check_loan_eligibility" },
    { id: "mcp-compliance", name: "Tuân thủ", status: "connected", lastTool: "run_aml_check" },
    { id: "mcp-core-banking", name: "Core banking", status: "mock" },
    { id: "mcp-product", name: "Sản phẩm", status: "mock", lastTool: "compare_products" },
    { id: "mcp-ops", name: "Vận hành", status: "mock" },
  ],
};

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
      "Bộ điều phối chia Tín dụng ‖ Pháp lý → Sản phẩm",
      "Công cụ đúng lĩnh vực nhờ danh sách cho phép",
      "Tác động hệ thống qua duyệt · nhật ký token/chi phí đầy đủ",
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
      "Một chuyên gia cầm mọi công cụ — dễ gọi sai lĩnh vực",
      "Ít trích dẫn / dễ bịa",
      "Rẻ token hơn nhưng thiếu kiểm soát cộng tác",
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
    planJson: { summary: "Phân loại 1 bước — chuyên gia Tín dụng" },
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
          label: "Tín dụng · tra cứu hạn mức thẻ",
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
