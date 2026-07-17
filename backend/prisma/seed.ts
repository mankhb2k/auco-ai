/**
 * Phase 2 seed — đồng bộ mock Frontend:
 * - data/mock/customers.json (24 KH)
 * - data/mock/knowledge.json (RAG lite)
 * - employees / portfolio / automation như frontend/src/lib/mock/seed.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * `railway run` from a laptop injects private DATABASE_URL
 * (*.railway.internal) which is unreachable outside Railway.
 * Prefer DATABASE_PUBLIC_URL in that case.
 */
function resolveSeedDatabaseUrl(): string {
  const privateUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.DATABASE_PRIVATE_URL?.trim() ||
    "";
  const publicUrl =
    process.env.DATABASE_PUBLIC_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    "";

  const isRailwayInternal =
    privateUrl.includes(".railway.internal") ||
    privateUrl.includes("postgres.railway.internal");

  if (isRailwayInternal) {
    if (!publicUrl) {
      throw new Error(
        [
          "DATABASE_URL points to railway.internal (private network).",
          "From your laptop, seed needs the public URL.",
          "Fix: Railway → Postgres → Variables → copy DATABASE_PUBLIC_URL,",
          'then: railway run -e DATABASE_URL="$DATABASE_PUBLIC_URL" npm run prisma:seed',
          "Or in Variables of auco-ai, ensure DATABASE_PUBLIC_URL is referenced,",
          "and re-run (seed will auto-pick it).",
        ].join(" "),
      );
    }
    console.log("[seed] Using DATABASE_PUBLIC_URL (local railway run)");
    return publicUrl;
  }

  const url = privateUrl || publicUrl;
  if (!url) {
    throw new Error("DATABASE_URL (or DATABASE_PUBLIC_URL) is required for seed");
  }
  return url;
}

const connectionString = resolveSeedDatabaseUrl();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type CustomerMock = {
  id: string;
  customerNo: string;
  fullName: string;
  branchCode: string;
  bankCode: string;
  [key: string]: unknown;
};

type KnowledgeMock = {
  id: string;
  domain: string;
  bankCode: string;
  title: string;
  sourceUrl: string | null;
  content: string;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

function loadJson<T>(relativePath: string): T {
  // prisma/seed.ts → ../data/mock/<file>
  const full = join(__dirname, "..", "data", "mock", relativePath);
  return JSON.parse(readFileSync(full, "utf8")) as T;
}

async function seedEmployees(bankCode: string) {
  const rows = [
    {
      id: "emp-credit-b",
      displayName: "Nguyễn Thị B — Chuyên viên Tín dụng",
      role: "credit_officer",
      branchCode: "CN_CAU_GIAY",
    },
    {
      id: "emp-ops-c",
      displayName: "Trần Văn C — Nhân viên Vận hành",
      role: "ops_officer",
      branchCode: "CN_CAU_GIAY",
    },
    {
      id: "emp-mgr-d",
      displayName: "Lê Minh D — Giám đốc chi nhánh",
      role: "branch_manager",
      branchCode: "CN_CAU_GIAY",
    },
  ] as const;

  for (const row of rows) {
    await prisma.employee.upsert({
      where: { id: row.id },
      update: {
        displayName: row.displayName,
        role: row.role,
        branchCode: row.branchCode,
        bankCode,
      },
      create: { ...row, bankCode },
    });
  }

  return rows.map((r) => r.id);
}

async function seedCustomers(bankCode: string) {
  const file = loadJson<{ customers: CustomerMock[] }>("customers.json");
  for (const c of file.customers) {
    const {
      id,
      customerNo,
      fullName,
      branchCode,
      bankCode: _bc,
      ...profile
    } = c;

    await prisma.customer.upsert({
      where: {
        bankCode_customerNo: { bankCode, customerNo },
      },
      update: {
        id,
        fullName,
        branchCode,
        profileJson: { ...profile, customerNo, fullName, branchCode },
      },
      create: {
        id,
        bankCode,
        customerNo,
        fullName,
        branchCode,
        profileJson: { ...profile, customerNo, fullName, branchCode },
      },
    });
  }
  return file.customers;
}

async function seedPortfolios(bankCode: string, customers: CustomerMock[]) {
  // FE: portfolio CN Cầu Giấy cho credit + ops — KH Hà Đông (ngoài danh mục) không gán
  const inPortfolio = customers.filter((c) => c.branchCode === "CN_CAU_GIAY");
  const employeeIds = ["emp-credit-b", "emp-ops-c"] as const;

  let count = 0;
  for (const c of inPortfolio) {
    for (const employeeId of employeeIds) {
      await prisma.customerPortfolio.upsert({
        where: {
          employeeId_customerId: {
            employeeId,
            customerId: c.id,
          },
        },
        update: { bankCode },
        create: {
          bankCode,
          employeeId,
          customerId: c.id,
        },
      });
      count += 1;
    }
  }
  return count;
}

async function seedKnowledge(bankCode: string) {
  const docs = loadJson<KnowledgeMock[]>("knowledge.json");
  for (const d of docs) {
    await prisma.knowledgeDocument.upsert({
      where: { id: d.id },
      update: {
        domain: d.domain,
        bankCode,
        title: d.title,
        sourceUrl: d.sourceUrl,
        content: d.content,
        status: d.status,
        effectiveFrom: d.effectiveFrom ? new Date(d.effectiveFrom) : null,
        effectiveTo: d.effectiveTo ? new Date(d.effectiveTo) : null,
      },
      create: {
        id: d.id,
        domain: d.domain,
        bankCode,
        title: d.title,
        sourceUrl: d.sourceUrl,
        content: d.content,
        status: d.status,
        effectiveFrom: d.effectiveFrom ? new Date(d.effectiveFrom) : null,
        effectiveTo: d.effectiveTo ? new Date(d.effectiveTo) : null,
      },
    });
  }

  // v2 amends v1 (RAG lite §4.3)
  const relId = "rel-shb-td-v2-amends-v1";
  await prisma.documentRelation.upsert({
    where: { id: relId },
    update: {
      relationType: "amends",
      note: "Điều 5.2 LTV nhà xưởng — bản 2025 sửa bản 2022–2024",
    },
    create: {
      id: relId,
      fromDocId: "doc-shb-td-v2",
      toDocId: "doc-shb-td-v1",
      relationType: "amends",
      note: "Điều 5.2 LTV nhà xưởng — bản 2025 sửa bản 2022–2024",
    },
  });

  return docs.length;
}

async function seedAutomation(bankCode: string) {
  await prisma.automation.upsert({
    where: { id: "auto-monthly-risk" },
    update: {
      name: "Báo cáo rủi ro tín dụng tháng",
      description:
        "Mỗi ngày 1 hàng tháng 08:00 — trích xuất KH/giao dịch tháng trước, tóm tắt rủi ro, gửi thông báo.",
      createdByAgentRole: "credit",
      triggerType: "schedule",
      cronExpr: "0 8 1 * *",
      timezone: "Asia/Ho_Chi_Minh",
      enabled: false,
      status: "pending_approval",
      bankCode,
      graphJson: {
        steps: [
          { type: "trigger.cron", cronExpr: "0 8 1 * *" },
          { type: "extract", capability: "core-banking" },
          { type: "llm-transform", purpose: "risk_summary" },
          { type: "notification", channel: "dashboard" },
        ],
      },
      nextRunAt: new Date("2026-08-01T01:00:00.000Z"),
    },
    create: {
      id: "auto-monthly-risk",
      bankCode,
      name: "Báo cáo rủi ro tín dụng tháng",
      description:
        "Mỗi ngày 1 hàng tháng 08:00 — trích xuất KH/giao dịch tháng trước, tóm tắt rủi ro, gửi thông báo.",
      createdByAgentRole: "credit",
      triggerType: "schedule",
      cronExpr: "0 8 1 * *",
      timezone: "Asia/Ho_Chi_Minh",
      enabled: false,
      status: "pending_approval",
      graphJson: {
        steps: [
          { type: "trigger.cron", cronExpr: "0 8 1 * *" },
          { type: "extract", capability: "core-banking" },
          { type: "llm-transform", purpose: "risk_summary" },
          { type: "notification", channel: "dashboard" },
        ],
      },
      nextRunAt: new Date("2026-08-01T01:00:00.000Z"),
    },
  });

  await prisma.automationRun.upsert({
    where: { id: "arun-1" },
    update: {
      status: "done",
      resultSummary:
        "Dry-run: 128 KH trong danh mục, 3 cảnh báo rủi ro trung bình.",
      finishedAt: new Date("2026-07-01T01:01:04.000Z"),
    },
    create: {
      id: "arun-1",
      automationId: "auto-monthly-risk",
      status: "done",
      startedAt: new Date("2026-07-01T01:00:12.000Z"),
      finishedAt: new Date("2026-07-01T01:01:04.000Z"),
      resultSummary:
        "Dry-run: 128 KH trong danh mục, 3 cảnh báo rủi ro trung bình.",
    },
  });
}

async function main() {
  const bankCode = "SHB";

  // Clean legacy phase-1 seed ids that conflict with FE ids
  await prisma.customerPortfolio.deleteMany({
    where: {
      OR: [
        { employeeId: "seed-employee-credit" },
        { customerId: "seed-customer-a" },
      ],
    },
  });
  await prisma.customer.deleteMany({
    where: { id: "seed-customer-a" },
  });
  await prisma.employee.deleteMany({
    where: { id: "seed-employee-credit" },
  });
  await prisma.automation.deleteMany({
    where: { id: "seed-automation-monthly-risk" },
  });

  const employeeIds = await seedEmployees(bankCode);
  const customers = await seedCustomers(bankCode);
  const portfolioCount = await seedPortfolios(bankCode, customers);
  const knowledgeCount = await seedKnowledge(bankCode);
  await seedAutomation(bankCode);

  const outOfPortfolio = customers.filter(
    (c) => c.branchCode !== "CN_CAU_GIAY",
  ).length;

  console.log("Phase 2 seed OK:", {
    bankCode,
    employees: employeeIds.length,
    customers: customers.length,
    portfolios: portfolioCount,
    outOfPortfolioCustomers: outOfPortfolio,
    knowledgeDocuments: knowledgeCount,
    documentRelations: 1,
    automations: 1,
    automationRuns: 1,
    demoTags: {
      vay_mua_nha: "cus-001",
      vay_dn_50ty: "cus-002",
      fx_canh_bao: "cus-003",
      ngoai_danh_muc: "cus-004",
    },
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
