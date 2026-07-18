import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { disconnectPrisma, findCustomer, jsonResult } from '../shared/db.js';
import { checkLoanEligibility } from '../shared/domain-logic.js';
import {
  getLoanApplication,
  persistLoanApplication,
} from '../shared/mutation-store.js';

const server = new McpServer({
  name: 'mcp-los-shb',
  version: '1.0.0',
});

server.registerTool(
  'check_loan_eligibility',
  {
    description:
      'Kiểm tra khả năng vay / hạn mức đề xuất từ hồ sơ LOS (seed Postgres).',
    inputSchema: {
      customerNo: z.string().optional().describe('Mã KH SHB, vd SHB-KH-1001'),
      customerId: z.string().optional(),
      fullName: z.string().optional(),
      bankCode: z.string().optional().default('SHB'),
      requestedAmountVnd: z.number().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async (args) => {
    const customer = await findCustomer(args);
    if (!customer) {
      return jsonResult({
        error: 'customer_not_found',
        query: args,
      });
    }
    return jsonResult(
      checkLoanEligibility(customer, args.requestedAmountVnd),
    );
  },
);

server.registerTool(
  'get_collateral_package',
  {
    description:
      'Tra cứu hồ sơ tài sản bảo đảm và tính LTV thực tế từ giá trị định giá hợp lệ gần nhất.',
    inputSchema: {
      customerNo: z.string().optional(),
      customerId: z.string().optional(),
      fullName: z.string().optional(),
      bankCode: z.string().optional().default('SHB'),
      requestedAmountVnd: z.number().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async (args) => {
    const customer = await findCustomer(args);
    if (!customer) {
      return jsonResult({ error: 'customer_not_found', query: args });
    }

    const unsecured = /tín chấp/i.test(customer.loanCollateralType ?? '');
    const appraisedValueVnd = Number(customer.appraisedValueVnd ?? 0);
    const requestedAmountVnd = Number(
      args.requestedAmountVnd ?? customer.requestedLoanVnd ?? 0,
    );
    const ltvActual =
      appraisedValueVnd > 0 && requestedAmountVnd > 0
        ? Number(((requestedAmountVnd / appraisedValueVnd) * 100).toFixed(2))
        : null;
    const appraisalDate = customer.appraisalDate
      ? new Date(customer.appraisalDate)
      : null;
    const appraisalAgeMonths = appraisalDate
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - appraisalDate.getTime()) /
              (1000 * 60 * 60 * 24 * 30.44),
          ),
        )
      : null;
    const maxAgeMonths = /ô tô|máy móc|phương tiện/i.test(
      customer.loanCollateralType ?? '',
    )
      ? 6
      : 12;

    return jsonResult({
      customerNo: customer.customerNo,
      collateralType: customer.loanCollateralType ?? null,
      description: customer.collateralDescription ?? null,
      appraisedValueVnd: appraisedValueVnd || null,
      appraisalDate: customer.appraisalDate ?? null,
      appraiser: customer.appraiser ?? null,
      appraisalAgeMonths,
      maxAgeMonths,
      appraisalFresh:
        unsecured ||
        (appraisalAgeMonths !== null && appraisalAgeMonths <= maxAgeMonths),
      ownershipStatus: customer.ownershipStatus ?? 'unknown',
      securityRegistrationStatus:
        customer.securityRegistrationStatus ?? 'unknown',
      requestedAmountVnd: requestedAmountVnd || null,
      ltvActual,
      unsecured,
    });
  },
);

server.registerTool(
  'submit_loan_application',
  {
    description:
      'Gửi hồ sơ vay (side-effect). Demo: lưu draft pending_approval — Approval Phase 8.',
    inputSchema: {
      customerNo: z.string().optional(),
      customerId: z.string().optional(),
      fullName: z.string().optional(),
      bankCode: z.string().optional().default('SHB'),
      amountVnd: z.number(),
      productId: z.string().optional(),
      note: z.string().optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async (args) => {
    const customer = await findCustomer(args);
    if (!customer) {
      return jsonResult({ error: 'customer_not_found', query: args });
    }
    const applicationId = `LA-${Date.now().toString(36).toUpperCase()}`;
    const app = await persistLoanApplication({
      applicationId,
      customerNo: customer.customerNo,
      fullName: customer.fullName,
      bankCode: customer.bankCode,
      amountVnd: args.amountVnd,
      productId: args.productId ?? null,
      note: args.note ?? null,
      status: 'pending_approval',
      requiresApproval: true,
      mutates: true,
      createdAt: new Date().toISOString(),
    });
    return jsonResult(app);
  },
);

server.registerTool(
  'get_loan_application_status',
  {
    description: 'Tra cứu trạng thái hồ sơ vay đã submit.',
    inputSchema: {
      applicationId: z.string(),
    },
    annotations: { readOnlyHint: true },
  },
  async (args) => {
    const app = await getLoanApplication(args.applicationId);
    return jsonResult(
      app ?? { error: 'not_found', applicationId: args.applicationId },
    );
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mcp-los-shb listening on stdio');
}

main().catch(async (err) => {
  console.error(err);
  await disconnectPrisma();
  process.exit(1);
});
