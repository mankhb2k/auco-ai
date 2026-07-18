import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  disconnectPrisma,
  findCustomer,
  getPrisma,
  jsonResult,
} from '../shared/db.js';
import { runAmlCheck } from '../shared/domain-logic.js';
import { persistFlag } from '../shared/mutation-store.js';

const server = new McpServer({
  name: 'mcp-compliance-shb',
  version: '1.0.0',
});

server.registerTool(
  'run_aml_check',
  {
    description: 'Chạy AML/KYC check trên hồ sơ khách hàng (seed).',
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
      return jsonResult({ error: 'customer_not_found', query: args });
    }
    return jsonResult(runAmlCheck(customer));
  },
);

server.registerTool(
  'search_regulation',
  {
    description:
      'Tìm quy định / chính sách (keyword trên KnowledgeDocument domain legal — embeddings Phase 7).',
    inputSchema: {
      query: z.string().min(1),
      bankCode: z.string().optional().default('SHB'),
      limit: z.number().int().min(1).max(10).optional().default(5),
    },
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const prisma = getPrisma();
    const q = args.query.trim();
    const docs = await prisma.knowledgeDocument.findMany({
      where: {
        bankCode: args.bankCode ?? 'SHB',
        domain: 'legal',
        status: 'active',
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: args.limit ?? 5,
      orderBy: { title: 'asc' },
    });

    // Fallback: broader search if no legal hit
    const fallback =
      docs.length > 0
        ? docs
        : await prisma.knowledgeDocument.findMany({
            where: {
              bankCode: args.bankCode ?? 'SHB',
              status: 'active',
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
              ],
            },
            take: args.limit ?? 5,
          });

    return jsonResult({
      query: q,
      count: fallback.length,
      hits: fallback.map((d) => ({
        id: d.id,
        title: d.title,
        domain: d.domain,
        excerpt: d.content.slice(0, 280),
        effectiveFrom: d.effectiveFrom,
        status: d.status,
      })),
      source: 'mcp-compliance',
      note: 'Keyword search — vector RAG in Phase 7',
    });
  },
);

server.registerTool(
  'flag_transaction',
  {
    description:
      'Gắn cờ giao dịch nghi ngờ (mutate). Demo lưu file runtime; Approval Phase 8.',
    inputSchema: {
      customerNo: z.string().optional(),
      customerId: z.string().optional(),
      fullName: z.string().optional(),
      bankCode: z.string().optional().default('SHB'),
      amountVnd: z.number().optional(),
      currency: z.string().optional().default('VND'),
      reason: z.string().min(1),
    },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  async (args) => {
    const customer = await findCustomer(args);
    const flagId = `FLG-${Date.now().toString(36).toUpperCase()}`;
    const flag = await persistFlag({
      flagId,
      customerNo: customer?.customerNo ?? args.customerNo ?? null,
      fullName: customer?.fullName ?? args.fullName ?? null,
      bankCode: args.bankCode ?? 'SHB',
      amountVnd: args.amountVnd ?? null,
      currency: args.currency ?? 'VND',
      reason: args.reason,
      status: 'pending_approval',
      requiresApproval: true,
      mutates: true,
      createdAt: new Date().toISOString(),
    });
    return jsonResult(flag);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mcp-compliance-shb listening on stdio');
}

main().catch(async (err) => {
  console.error(err);
  await disconnectPrisma();
  process.exit(1);
});
