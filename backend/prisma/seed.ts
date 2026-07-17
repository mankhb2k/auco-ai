import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seed');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const bankCode = 'SHB';

  const employee = await prisma.employee.upsert({
    where: { id: 'seed-employee-credit' },
    update: {},
    create: {
      id: 'seed-employee-credit',
      bankCode,
      displayName: 'Nguyễn Thị B — Chuyên viên Tín dụng',
      role: 'credit_officer',
      branchCode: 'CN-CG',
    },
  });

  const customer = await prisma.customer.upsert({
    where: {
      bankCode_customerNo: { bankCode, customerNo: 'SHB-KH-001' },
    },
    update: {},
    create: {
      id: 'seed-customer-a',
      bankCode,
      fullName: 'Nguyễn Văn A',
      customerNo: 'SHB-KH-001',
      branchCode: 'CN-CG',
    },
  });

  await prisma.customerPortfolio.upsert({
    where: {
      employeeId_customerId: {
        employeeId: employee.id,
        customerId: customer.id,
      },
    },
    update: {},
    create: {
      bankCode,
      employeeId: employee.id,
      customerId: customer.id,
    },
  });

  await prisma.automation.upsert({
    where: { id: 'seed-automation-monthly-risk' },
    update: {},
    create: {
      id: 'seed-automation-monthly-risk',
      bankCode,
      name: 'Báo cáo rủi ro tín dụng tháng',
      description:
        'Mỗi ngày 1 hàng tháng 08:00 — trích xuất + tóm tắt rủi ro tín dụng tháng trước',
      createdByAgentRole: 'credit',
      triggerType: 'schedule',
      cronExpr: '0 8 1 * *',
      timezone: 'Asia/Ho_Chi_Minh',
      enabled: false,
      status: 'draft',
      graphJson: {
        steps: [
          { type: 'trigger.cron', cronExpr: '0 8 1 * *' },
          { type: 'extract', capability: 'core-banking' },
          { type: 'llm-transform', purpose: 'risk_summary' },
          { type: 'notification', channel: 'dashboard' },
        ],
      },
    },
  });

  console.log('Seed OK:', {
    employee: employee.displayName,
    customer: customer.fullName,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
