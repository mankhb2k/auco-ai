/** Mock dữ liệu cho tab governance (Knowledge / MCP / Audit) — FE demo không cần backend. */

export type KnowledgeUiDocument = {
  id: string;
  domain: "credit" | "legal" | "product" | "ops";
  title: string;
  content: string;
  status: "draft" | "active" | "superseded";
  updatedAt: string;
  publishedAt: string | null;
};

export type McpUiCapability =
  | "los"
  | "compliance"
  | "core-banking"
  | "product"
  | "ops";

export type McpUiConnector = {
  capability: McpUiCapability;
  serverName: string;
  implementation: "real" | "stub";
  enabled: boolean;
  status: "enabled" | "disabled";
  tools: Array<{ name: string; mutates: boolean }>;
};

export type McpUiSuite = {
  suite: string;
  bankCode: string;
  connected: boolean;
  connectorCount: number;
  enabledCount: number;
  connectors: McpUiConnector[];
};

export type AuditUiEvent = {
  id: string;
  actorId: string;
  action: string;
  resource: string;
  detailJson?: Record<string, unknown> | null;
  createdAt: string;
};

export const seedKnowledgeDocuments: KnowledgeUiDocument[] = [
  {
    id: "kb-draft-ltv",
    domain: "credit",
    title: "Chính sách LTV nhà xưởng 2026 (bản nháp)",
    content:
      "LTV tối đa với nhà xưởng/TSĐB sản xuất: 75%. Áp dụng từ Q3/2026 sau khi hội đồng tín dụng duyệt.",
    status: "draft",
    updatedAt: "2026-07-17T09:20:00+07:00",
    publishedAt: null,
  },
  {
    id: "kb-active-tt39",
    domain: "credit",
    title: "Thông tư 39/2016/TT-NHNN — trích LTV",
    content:
      "Tỷ lệ cho vay tối đa trên giá trị tài sản bảo đảm (LTV) đối với BĐS sản xuất kinh doanh có thể lên tới 80%.",
    status: "active",
    updatedAt: "2026-07-10T14:00:00+07:00",
    publishedAt: "2026-07-10T14:00:00+07:00",
  },
  {
    id: "kb-active-aml",
    domain: "legal",
    title: "SBV-4889 AML / KYC — Điều 8",
    content:
      "Yêu cầu KYC đầy đủ trước khi cấp tín dụng hoặc giao dịch ngoại tệ lớn.",
    status: "active",
    updatedAt: "2026-07-08T11:30:00+07:00",
    publishedAt: "2026-07-08T11:30:00+07:00",
  },
  {
    id: "kb-superseded-dti",
    domain: "credit",
    title: "Chính sách DTI (bản cũ)",
    content: "DTI cá nhân ≤ 55% — đã được thay bởi bản 2024.",
    status: "superseded",
    updatedAt: "2024-05-01T08:00:00+07:00",
    publishedAt: "2024-01-15T08:00:00+07:00",
  },
  {
    id: "kb-active-product",
    domain: "product",
    title: "Bảng lãi suất vay DN ngắn hạn Q2/2026",
    content:
      "Lãi suất tham chiếu vay ngắn hạn DN từ 7.2%/năm — 9.5%/năm tùy hạng rủi ro.",
    status: "active",
    updatedAt: "2026-07-12T16:45:00+07:00",
    publishedAt: "2026-07-12T16:45:00+07:00",
  },
];

export const seedMcpSuite: McpUiSuite = {
  suite: "Bộ kết nối MCP SHB",
  bankCode: "SHB",
  connected: true,
  connectorCount: 5,
  enabledCount: 5,
  connectors: [
    {
      capability: "los",
      serverName: "mcp-los-shb",
      implementation: "real",
      enabled: true,
      status: "enabled",
      tools: [
        { name: "check_loan_eligibility", mutates: false },
        { name: "submit_loan_application", mutates: true },
      ],
    },
    {
      capability: "compliance",
      serverName: "mcp-compliance-shb",
      implementation: "real",
      enabled: true,
      status: "enabled",
      tools: [
        { name: "run_aml_check", mutates: false },
        { name: "flag_compliance_case", mutates: true },
      ],
    },
    {
      capability: "core-banking",
      serverName: "mcp-core-banking-shb",
      implementation: "stub",
      enabled: true,
      status: "enabled",
      tools: [
        { name: "get_credit_score", mutates: false },
        { name: "get_transaction_history", mutates: false },
      ],
    },
    {
      capability: "product",
      serverName: "mcp-product-shb",
      implementation: "stub",
      enabled: true,
      status: "enabled",
      tools: [{ name: "compare_products", mutates: false }],
    },
    {
      capability: "ops",
      serverName: "mcp-ops-shb",
      implementation: "stub",
      enabled: true,
      status: "enabled",
      tools: [{ name: "create_disbursement_ticket", mutates: true }],
    },
  ],
};

export const seedAuditEvents: AuditUiEvent[] = [
  {
    id: "aud-1",
    actorId: "emp-mgr-d",
    action: "knowledge.publish",
    resource: "KnowledgeDocument:kb-active-tt39",
    detailJson: { domain: "credit", title: "Thông tư 39/2016/TT-NHNN — trích LTV" },
    createdAt: "2026-07-10T14:00:12+07:00",
  },
  {
    id: "aud-2",
    actorId: "emp-mgr-d",
    action: "approval.approve",
    resource: "TaskStep:step-portfolio-1",
    detailJson: {
      reason: "out_of_portfolio_access",
      customerNo: "SHB-KH-9999",
    },
    createdAt: "2026-07-15T10:22:41+07:00",
  },
  {
    id: "aud-3",
    actorId: "emp-credit-b",
    action: "task_run.create",
    resource: "TaskRun:trun-demo-1",
    detailJson: { mode: "multi", scenario: "home" },
    createdAt: "2026-07-15T10:18:05+07:00",
  },
  {
    id: "aud-4",
    actorId: "emp-it-e",
    action: "mcp.connector.set_enabled",
    resource: "McpConnector:ops",
    detailJson: { enabled: false, serverName: "mcp-ops-shb" },
    createdAt: "2026-07-16T08:05:33+07:00",
  },
  {
    id: "aud-5",
    actorId: "emp-it-e",
    action: "mcp.connector.set_enabled",
    resource: "McpConnector:ops",
    detailJson: { enabled: true, serverName: "mcp-ops-shb" },
    createdAt: "2026-07-16T08:06:10+07:00",
  },
  {
    id: "aud-6",
    actorId: "emp-mgr-d",
    action: "knowledge.create_draft",
    resource: "KnowledgeDocument:kb-draft-ltv",
    detailJson: { domain: "credit", title: "Chính sách LTV nhà xưởng 2026 (bản nháp)" },
    createdAt: "2026-07-17T09:20:00+07:00",
  },
];
