import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

config({ path: resolve(process.cwd(), '.env') });

let client: PrismaClient | null = null;
let pool: Pool | null = null;

export function getPrisma(): PrismaClient {
  if (client) return client;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required for MCP servers');
  }
  pool = new Pool({ connectionString: url });
  client = new PrismaClient({ adapter: new PrismaPg(pool) });
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type CustomerProfile = {
  id: string;
  customerNo: string;
  fullName: string;
  bankCode: string;
  cicGroup?: number;
  cicLabel?: string;
  monthlyIncomeVnd?: number;
  equityCapitalVnd?: number;
  requestedLoanVnd?: number;
  loanPurpose?: string;
  loanCollateralType?: string;
  demoTag?: string;
  customerType?: string;
  segment?: string;
  [key: string]: unknown;
};

export async function findCustomer(opts: {
  bankCode?: string;
  customerId?: string;
  customerNo?: string;
  fullName?: string;
}): Promise<CustomerProfile | null> {
  const prisma = getPrisma();
  const bankCode = opts.bankCode?.trim() || 'SHB';

  if (opts.customerId) {
    const row = await prisma.customer.findFirst({
      where: { id: opts.customerId, bankCode },
    });
    if (row) return mergeProfile(row);
  }

  if (opts.customerNo) {
    const row = await prisma.customer.findFirst({
      where: { customerNo: opts.customerNo, bankCode },
    });
    if (row) return mergeProfile(row);
  }

  if (opts.fullName) {
    const row = await prisma.customer.findFirst({
      where: {
        bankCode,
        fullName: { contains: opts.fullName, mode: 'insensitive' },
      },
    });
    if (row) return mergeProfile(row);
  }

  return null;
}

function mergeProfile(row: {
  id: string;
  customerNo: string;
  fullName: string;
  bankCode: string;
  profileJson: unknown;
}): CustomerProfile {
  const profile =
    row.profileJson && typeof row.profileJson === 'object'
      ? (row.profileJson as Record<string, unknown>)
      : {};
  return {
    ...profile,
    id: row.id,
    customerNo: row.customerNo,
    fullName: row.fullName,
    bankCode: row.bankCode,
  };
}

export function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}
