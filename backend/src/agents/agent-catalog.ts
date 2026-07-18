export type AgentRole = 'credit' | 'legal' | 'collateral' | 'product' | 'ops';

export type AgentCapability = {
  role: AgentRole;
  displayName: string;
  mission: string;
  intents: string[];
  capabilities: string[];
  allowedMcp: string[];
  inputHints: string[];
  outputSchemaKey: string;
};

export const AGENT_CATALOG: AgentCapability[] = [
  {
    role: 'credit',
    displayName: 'Credit Agent',
    mission:
      'Đánh giá khả năng vay, điểm tín dụng, lịch sử giao dịch. Không làm AML/tuân thủ.',
    intents: ['vay', 'tín dụng', 'hạn mức', 'CIC', 'DTI', 'khả năng trả nợ'],
    capabilities: [
      'loan_eligibility',
      'credit_score',
      'transaction_history',
      'account_balance',
    ],
    allowedMcp: ['los', 'core-banking'],
    inputHints: ['customerId', 'amount', 'loanPurpose'],
    outputSchemaKey: 'creditAssessment',
  },
  {
    role: 'legal',
    displayName: 'Legal / Compliance Agent',
    mission:
      'AML/KYC, quy định SBV, flag giao dịch. Không đánh giá hạn mức tín dụng.',
    intents: ['AML', 'KYC', 'tuân thủ', 'quy định', 'SBV', 'ngoại tệ', 'FX'],
    capabilities: ['aml_check', 'regulation_search', 'flag_transaction'],
    allowedMcp: ['compliance'],
    inputHints: ['customerId', 'transactionAmount', 'currency'],
    outputSchemaKey: 'complianceAssessment',
  },
  {
    role: 'collateral',
    displayName: 'Collateral Agent',
    mission:
      'Đánh giá tài sản bảo đảm, LTV thực tế, quyền sở hữu, đăng ký giao dịch bảo đảm và độ mới của định giá.',
    intents: ['tài sản bảo đảm', 'TSĐB', 'LTV', 'định giá', 'thế chấp'],
    capabilities: [
      'collateral_lookup',
      'ltv_check',
      'ownership_check',
      'appraisal_freshness',
    ],
    allowedMcp: ['los'],
    inputHints: ['customerId', 'amount', 'collateralType'],
    outputSchemaKey: 'collateralAssessment',
  },
  {
    role: 'product',
    displayName: 'Product Agent',
    mission:
      'So sánh / đề xuất sản phẩm, biểu phí, lãi suất phù hợp hồ sơ đã đánh giá.',
    intents: ['sản phẩm', 'biểu phí', 'lãi suất', 'so sánh', 'gói vay'],
    capabilities: [
      'list_products',
      'compare_products',
      'product_eligibility',
    ],
    allowedMcp: ['product'],
    inputHints: ['customerSegment', 'amount', 'loanPurpose'],
    outputSchemaKey: 'productRecommendation',
  },
  {
    role: 'ops',
    displayName: 'Operations Agent',
    mission:
      'Ticket vận hành, gán phòng ban, theo dõi hồ sơ. Không quyết định phê duyệt tín dụng.',
    intents: ['ticket', 'hồ sơ', 'vận hành', 'giải ngân', 'phòng ban'],
    capabilities: ['create_ticket', 'assign_department', 'ticket_status'],
    allowedMcp: ['ops', 'los'],
    inputHints: ['customerId', 'applicationId'],
    outputSchemaKey: 'opsTicket',
  },
];

export function getAgentByRole(role: AgentRole): AgentCapability {
  const found = AGENT_CATALOG.find((a) => a.role === role);
  if (!found) {
    throw new Error(`Unknown agent role: ${role}`);
  }
  return found;
}

export function catalogPromptBlock(): string {
  return AGENT_CATALOG.map(
    (a) =>
      `- ${a.role} (${a.displayName}): ${a.mission} | capabilities=[${a.capabilities.join(', ')}] | MCP=[${a.allowedMcp.join(', ')}]`,
  ).join('\n');
}
