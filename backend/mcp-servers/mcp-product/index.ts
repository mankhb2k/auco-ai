import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { jsonResult } from '../shared/db.js';
import { SHB_PRODUCTS } from '../shared/domain-logic.js';

const server = new McpServer({
  name: 'mcp-product-shb',
  version: '1.0.0',
});

server.registerTool(
  'list_products',
  {
    description: 'Danh sách sản phẩm SHB (stub tĩnh).',
    inputSchema: {
      segment: z.string().optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const products = args.segment
      ? SHB_PRODUCTS.filter((p) => p.segment === args.segment)
      : SHB_PRODUCTS;
    return jsonResult({ products, implementation: 'stub', source: 'mcp-product' });
  },
);

server.registerTool(
  'check_product_eligibility',
  {
    description: 'Kiểm tra KH có đủ điều kiện sản phẩm (stub).',
    inputSchema: {
      productId: z.string(),
      customerSegment: z.string().optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const product = SHB_PRODUCTS.find((p) => p.id === args.productId);
    if (!product) {
      return jsonResult({ eligible: false, error: 'product_not_found' });
    }
    const eligible =
      !args.customerSegment || product.segment === args.customerSegment;
    return jsonResult({
      productId: product.id,
      name: product.name,
      eligible,
      implementation: 'stub',
    });
  },
);

server.registerTool(
  'compare_products',
  {
    description: 'So sánh / đề xuất sản phẩm theo mục đích (stub).',
    inputSchema: {
      purpose: z.string().optional(),
      segment: z.string().optional(),
      amountVnd: z.number().optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const purpose = (args.purpose ?? '').toLowerCase();
    let filtered = [...SHB_PRODUCTS];
    if (args.segment) {
      filtered = filtered.filter((p) => p.segment === args.segment);
    }
    if (purpose.includes('nhà') || purpose.includes('home')) {
      filtered = filtered.filter((p) => p.purpose.includes('nhà'));
    } else if (purpose.includes('dn') || purpose.includes('nhà máy')) {
      filtered = filtered.filter((p) => p.segment === 'sme');
    } else if (purpose.includes('fx') || purpose.includes('ngoại')) {
      filtered = filtered.filter((p) => p.purpose.includes('ngoại'));
    }
    if (filtered.length === 0) filtered = SHB_PRODUCTS.slice(0, 2);
    return jsonResult({
      purpose: args.purpose ?? null,
      amountVnd: args.amountVnd ?? null,
      products: filtered,
      recommendedProduct: filtered[0]?.name ?? null,
      implementation: 'stub',
      source: 'mcp-product',
    });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mcp-product-shb listening on stdio');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
