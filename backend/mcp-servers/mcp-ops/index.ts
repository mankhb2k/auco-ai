import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { jsonResult } from '../shared/db.js';
import { getTicket, persistTicket } from '../shared/mutation-store.js';

const server = new McpServer({
  name: 'mcp-ops-shb',
  version: '1.0.0',
});

server.registerTool(
  'create_service_ticket',
  {
    description: 'Tạo ticket vận hành (mutate stub).',
    inputSchema: {
      subject: z.string().min(1),
      department: z.string().optional().default('ops'),
      customerNo: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
    },
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  async (args) => {
    const ticketId = `TK-${Date.now().toString(36).toUpperCase()}`;
    const ticket = await persistTicket({
      ticketId,
      subject: args.subject,
      department: args.department ?? 'ops',
      customerNo: args.customerNo ?? null,
      priority: args.priority ?? 'medium',
      status: 'open',
      mutates: true,
      requiresApproval: true,
      implementation: 'stub',
      createdAt: new Date().toISOString(),
    });
    return jsonResult(ticket);
  },
);

server.registerTool(
  'get_ticket_status',
  {
    description: 'Tra cứu trạng thái ticket.',
    inputSchema: {
      ticketId: z.string(),
    },
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const ticket = await getTicket(args.ticketId);
    return jsonResult(
      ticket ?? {
        ticketId: args.ticketId,
        status: 'not_found',
        implementation: 'stub',
      },
    );
  },
);

server.registerTool(
  'assign_department',
  {
    description: 'Gán ticket cho phòng ban (stub).',
    inputSchema: {
      ticketId: z.string(),
      department: z.string().min(1),
    },
    annotations: { readOnlyHint: false },
  },
  async (args) => {
    const existing = await getTicket(args.ticketId);
    const updated = {
      ...(existing ?? { ticketId: args.ticketId, status: 'open' }),
      department: args.department,
      assignedAt: new Date().toISOString(),
      implementation: 'stub',
    };
    await persistTicket(updated);
    return jsonResult(updated);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mcp-ops-shb listening on stdio');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
