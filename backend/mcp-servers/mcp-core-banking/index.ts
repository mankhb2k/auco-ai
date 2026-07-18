import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { disconnectPrisma, findCustomer, jsonResult } from '../shared/db.js';
import {
  accountBalanceFromProfile,
  creditScoreFromProfile,
  transactionHistoryFromProfile,
} from '../shared/domain-logic.js';

/** Shallow stub MCP — same contract, reads seed profile when available. */
const server = new McpServer({
  name: 'mcp-core-banking-shb',
  version: '1.0.0',
});

server.registerTool(
  'get_credit_score',
  {
    description: 'Lấy điểm tín dụng / CIC (stub nông từ profileJson).',
    inputSchema: {
      customerNo: z.string().optional(),
      customerId: z.string().optional(),
      fullName: z.string().optional(),
      bankCode: z.string().optional().default('SHB'),
    },
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const customer = await findCustomer(args);
    if (!customer) {
      return jsonResult({
        score: 700,
        cicGroup: 1,
        stub: true,
        note: 'default stub — customer not found',
      });
    }
    return jsonResult({ ...creditScoreFromProfile(customer), implementation: 'stub' });
  },
);

server.registerTool(
  'get_transaction_history',
  {
    description: 'Lịch sử giao dịch gần đây (stub nông).',
    inputSchema: {
      customerNo: z.string().optional(),
      customerId: z.string().optional(),
      fullName: z.string().optional(),
      bankCode: z.string().optional().default('SHB'),
    },
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const customer = await findCustomer(args);
    if (!customer) {
      return jsonResult({ months: 6, inflowStable: true, history: [], stub: true });
    }
    return jsonResult({
      ...transactionHistoryFromProfile(customer),
      implementation: 'stub',
    });
  },
);

server.registerTool(
  'get_account_balance',
  {
    description: 'Số dư khả dụng (stub nông).',
    inputSchema: {
      customerNo: z.string().optional(),
      customerId: z.string().optional(),
      fullName: z.string().optional(),
      bankCode: z.string().optional().default('SHB'),
    },
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const customer = await findCustomer(args);
    if (!customer) {
      return jsonResult({ availableBalanceVnd: 0, currency: 'VND', stub: true });
    }
    return jsonResult({
      ...accountBalanceFromProfile(customer),
      implementation: 'stub',
    });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mcp-core-banking-shb listening on stdio');
}

main().catch(async (err) => {
  console.error(err);
  await disconnectPrisma();
  process.exit(1);
});
