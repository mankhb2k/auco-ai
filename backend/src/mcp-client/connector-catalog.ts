export type McpCapability =
  | 'los'
  | 'compliance'
  | 'core-banking'
  | 'product'
  | 'ops';

export type McpToolMeta = {
  name: string;
  mutates: boolean;
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
};

export type BankMcpConnector = {
  bankCode: string;
  capability: McpCapability;
  serverName: string;
  transport: 'stdio';
  implementation: 'real' | 'stub';
  /** Relative to backend root, compiled entry */
  entryRel: string;
  /** Dev entry (tsx) */
  entryTsRel: string;
  tools: McpToolMeta[];
};

export const SHB_CONNECTORS: BankMcpConnector[] = [
  {
    bankCode: 'SHB',
    capability: 'los',
    serverName: 'mcp-los-shb',
    transport: 'stdio',
    implementation: 'real',
    entryRel: 'dist/mcp-servers/mcp-los/index.js',
    entryTsRel: 'mcp-servers/mcp-los/index.ts',
    tools: [
      {
        name: 'check_loan_eligibility',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'Kiểm tra khả năng vay / hạn mức',
      },
      {
        name: 'submit_loan_application',
        mutates: true,
        requiresApproval: true,
        riskLevel: 'high',
        description: 'Gửi hồ sơ vay (side-effect)',
      },
      {
        name: 'get_loan_application_status',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'Tra cứu trạng thái hồ sơ',
      },
    ],
  },
  {
    bankCode: 'SHB',
    capability: 'compliance',
    serverName: 'mcp-compliance-shb',
    transport: 'stdio',
    implementation: 'real',
    entryRel: 'dist/mcp-servers/mcp-compliance/index.js',
    entryTsRel: 'mcp-servers/mcp-compliance/index.ts',
    tools: [
      {
        name: 'run_aml_check',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'AML/KYC check',
      },
      {
        name: 'search_regulation',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'Tìm quy định (keyword)',
      },
      {
        name: 'flag_transaction',
        mutates: true,
        requiresApproval: true,
        riskLevel: 'high',
        description: 'Gắn cờ giao dịch',
      },
    ],
  },
  {
    bankCode: 'SHB',
    capability: 'core-banking',
    serverName: 'mcp-core-banking-shb',
    transport: 'stdio',
    implementation: 'stub',
    entryRel: 'dist/mcp-servers/mcp-core-banking/index.js',
    entryTsRel: 'mcp-servers/mcp-core-banking/index.ts',
    tools: [
      {
        name: 'get_credit_score',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'Điểm tín dụng / CIC',
      },
      {
        name: 'get_transaction_history',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'Lịch sử giao dịch',
      },
      {
        name: 'get_account_balance',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'Số dư tài khoản',
      },
    ],
  },
  {
    bankCode: 'SHB',
    capability: 'product',
    serverName: 'mcp-product-shb',
    transport: 'stdio',
    implementation: 'stub',
    entryRel: 'dist/mcp-servers/mcp-product/index.js',
    entryTsRel: 'mcp-servers/mcp-product/index.ts',
    tools: [
      {
        name: 'list_products',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'Danh sách sản phẩm',
      },
      {
        name: 'check_product_eligibility',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'Điều kiện sản phẩm',
      },
      {
        name: 'compare_products',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'So sánh sản phẩm',
      },
    ],
  },
  {
    bankCode: 'SHB',
    capability: 'ops',
    serverName: 'mcp-ops-shb',
    transport: 'stdio',
    implementation: 'stub',
    entryRel: 'dist/mcp-servers/mcp-ops/index.js',
    entryTsRel: 'mcp-servers/mcp-ops/index.ts',
    tools: [
      {
        name: 'create_service_ticket',
        mutates: true,
        requiresApproval: true,
        riskLevel: 'medium',
        description: 'Tạo ticket vận hành',
      },
      {
        name: 'get_ticket_status',
        mutates: false,
        requiresApproval: false,
        riskLevel: 'low',
        description: 'Trạng thái ticket',
      },
      {
        name: 'assign_department',
        mutates: true,
        requiresApproval: false,
        riskLevel: 'medium',
        description: 'Gán phòng ban',
      },
    ],
  },
];

/** Role → tools allowed (finer than capability alone). */
export const ROLE_TOOL_ALLOWLIST: Record<string, string[]> = {
  credit: [
    'get_credit_score',
    'get_transaction_history',
    'get_account_balance',
    'check_loan_eligibility',
  ],
  legal: ['run_aml_check', 'search_regulation'],
  product: [
    'list_products',
    'check_product_eligibility',
    'compare_products',
  ],
  ops: [
    'create_service_ticket',
    'get_ticket_status',
    'assign_department',
    'get_loan_application_status',
  ],
};

export function toolCapability(tool: string): McpCapability | null {
  for (const c of SHB_CONNECTORS) {
    if (c.tools.some((t) => t.name === tool)) return c.capability;
  }
  return null;
}

export function findConnector(
  bankCode: string,
  capability: McpCapability,
): BankMcpConnector | undefined {
  return SHB_CONNECTORS.find(
    (c) => c.bankCode === bankCode && c.capability === capability,
  );
}
