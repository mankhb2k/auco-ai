/**
 * Phase 2 seed — đồng bộ mock Frontend:
 * - data/mock/customers.json (24 KH)
 * - data/mock/knowledge.json (RAG lite)
 * - employees / portfolio / loan requests / HQ knowledge
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
  // role.md §7 — 3 lớp quyền demo: employee | manager | it_admin
  const rows = [
    {
      id: "emp-credit-b",
      displayName: "Nguyễn Thị B — Chuyên viên Tín dụng",
      role: "credit_officer",
      accessLayer: "employee",
      branchCode: "CN_CAU_GIAY",
    },
    {
      id: "emp-credit-f",
      displayName: "Phạm Quốc F — Chuyên viên Tín dụng",
      role: "credit_officer",
      accessLayer: "employee",
      branchCode: "CN_CAU_GIAY",
    },
    {
      id: "emp-credit-g",
      displayName: "Hoàng Mai G — Chuyên viên Tín dụng",
      role: "credit_officer",
      accessLayer: "employee",
      branchCode: "CN_CAU_GIAY",
    },
    {
      id: "emp-ops-c",
      displayName: "Trần Văn C — Nhân viên Vận hành",
      role: "ops_officer",
      accessLayer: "employee",
      branchCode: "CN_CAU_GIAY",
    },
    {
      id: "emp-mgr-d",
      displayName: "Lê Minh D — Giám đốc chi nhánh",
      role: "branch_manager",
      accessLayer: "manager",
      branchCode: "CN_CAU_GIAY",
    },
    {
      id: "emp-it-e",
      displayName: "Trần IT E — Quản trị Platform",
      role: "it_admin",
      accessLayer: "it_admin",
      branchCode: null,
    },
  ] as const;

  for (const row of rows) {
    await prisma.employee.upsert({
      where: { id: row.id },
      update: {
        displayName: row.displayName,
        role: row.role,
        accessLayer: row.accessLayer,
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
  // CN Cầu Giấy: 3 chuyên viên tín dụng + ops — KH Hà Đông (ngoài danh mục) không gán
  const inPortfolio = customers.filter((c) => c.branchCode === "CN_CAU_GIAY");
  const employeeIds = [
    "emp-credit-b",
    "emp-credit-f",
    "emp-credit-g",
    "emp-ops-c",
  ] as const;

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
  // Nguồn chuẩn = API hội sở (mock). Fallback knowledge.json nếu file HQ thiếu.
  let docs: KnowledgeMock[];
  try {
    const hq = loadJson<{ documents: KnowledgeMock[] }>("bank-hq-knowledge.json");
    docs = hq.documents;
  } catch {
    docs = loadJson<KnowledgeMock[]>("knowledge.json");
  }
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
        uploadedById: "emp-mgr-d",
        publishedAt: d.status === "active" ? new Date() : null,
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
        uploadedById: "emp-mgr-d",
        publishedAt: d.status === "active" ? new Date() : null,
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

type SeedLoanRow = {
  id: string;
  externalRef: string;
  customerId: string;
  requestedAmountVnd: string;
  loanPurpose: string;
  requestedTermMonths: number;
  declaredIncomeVnd: string | null;
  collateralType: string | null;
  estimatedCollateralVnd: string | null;
  status: string;
  assignedToId: string | null;
  assignedAt: Date | null;
  staffNote?: string | null;
  submittedAt?: Date | null;
  submittedById?: string | null;
  decision?: string | null;
  decisionNote?: string | null;
  decidedAt?: Date | null;
  decidedById?: string | null;
};

async function seedLoanRequests(bankCode: string) {
  const rows: SeedLoanRow[] = [
    {
      id: "loan-req-home-001",
      externalRef: "MOBILE-2026-0001",
      customerId: "cus-001",
      requestedAmountVnd: "2000000000",
      loanPurpose: "Mua nhà để ở",
      requestedTermMonths: 240,
      declaredIncomeVnd: "45000000",
      collateralType: "Bất động sản",
      estimatedCollateralVnd: "3000000000",
      status: "advised",
      assignedToId: "emp-credit-b",
      assignedAt: new Date("2026-07-18T01:00:00.000Z"),
    },
    {
      id: "loan-req-sme-002",
      externalRef: "MOBILE-2026-0002",
      customerId: "cus-002",
      requestedAmountVnd: "50000000000",
      loanPurpose: "Mở rộng nhà máy",
      requestedTermMonths: 84,
      declaredIncomeVnd: "8500000000",
      collateralType: "Nhà xưởng",
      estimatedCollateralVnd: "65000000000",
      status: "pending_approval",
      assignedToId: "emp-credit-f",
      assignedAt: new Date("2026-07-18T01:05:00.000Z"),
      staffNote:
        "Đề xuất hạn mức ~40 tỷ theo vốn tự có; vượt hạn mức chi nhánh — trình duyệt.",
      submittedAt: new Date("2026-07-18T03:00:00.000Z"),
      submittedById: "emp-credit-f",
    },
    {
      id: "loan-req-fx-003",
      externalRef: "MOBILE-2026-0003",
      customerId: "cus-003",
      requestedAmountVnd: "1000000000",
      loanPurpose: "Bổ sung vốn và chuyển đổi sang USD",
      requestedTermMonths: 36,
      declaredIncomeVnd: "38000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "rejected",
      assignedToId: "emp-credit-g",
      assignedAt: new Date("2026-07-18T01:10:00.000Z"),
      staffNote: "Có cảnh báo FX/AML — vẫn trình để cấp trên xem.",
      submittedAt: new Date("2026-07-18T03:10:00.000Z"),
      submittedById: "emp-credit-g",
      decision: "rejected",
      decisionNote: "Từ chối do rủi ro chuyển đổi ngoại tệ và cảnh báo AML.",
      decidedAt: new Date("2026-07-18T04:00:00.000Z"),
      decidedById: "emp-mgr-d",
    },
    {
      id: "loan-req-outscope-004",
      externalRef: "MOBILE-2026-0004",
      customerId: "cus-004",
      requestedAmountVnd: "700000000",
      loanPurpose: "Mua ô tô",
      requestedTermMonths: 60,
      declaredIncomeVnd: "32000000",
      collateralType: "Ô tô",
      estimatedCollateralVnd: "1000000000",
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-risk-005",
      externalRef: "MOBILE-2026-0005",
      customerId: "cus-005",
      requestedAmountVnd: "600000000",
      loanPurpose: "Vay tiêu dùng",
      requestedTermMonths: 48,
      declaredIncomeVnd: "28000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-home-006",
      externalRef: "MOBILE-2026-0006",
      customerId: "cus-006",
      requestedAmountVnd: "1500000000",
      loanPurpose: "Mua căn hộ chung cư",
      requestedTermMonths: 180,
      declaredIncomeVnd: "42000000",
      collateralType: "Bất động sản",
      estimatedCollateralVnd: "2200000000",
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-car-007",
      externalRef: "MOBILE-2026-0007",
      customerId: "cus-007",
      requestedAmountVnd: "450000000",
      loanPurpose: "Mua xe ô tô gia đình",
      requestedTermMonths: 60,
      declaredIncomeVnd: "35000000",
      collateralType: "Ô tô",
      estimatedCollateralVnd: "650000000",
      status: "pending_approval",
      assignedToId: "emp-credit-b",
      assignedAt: new Date("2026-07-18T02:00:00.000Z"),
      staffNote: "Hồ sơ sạch, LTV hợp lý — đề nghị phê duyệt trong hạn mức.",
      submittedAt: new Date("2026-07-18T03:20:00.000Z"),
      submittedById: "emp-credit-b",
    },
    {
      id: "loan-req-biz-008",
      externalRef: "MOBILE-2026-0008",
      customerId: "cus-008",
      requestedAmountVnd: "3000000000",
      loanPurpose: "Bổ sung vốn lưu động kinh doanh",
      requestedTermMonths: 36,
      declaredIncomeVnd: "120000000",
      collateralType: "Bất động sản",
      estimatedCollateralVnd: "4500000000",
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-sme-009",
      externalRef: "MOBILE-2026-0009",
      customerId: "cus-009",
      requestedAmountVnd: "12000000000",
      loanPurpose: "Nhập khẩu hàng hóa thương mại",
      requestedTermMonths: 24,
      declaredIncomeVnd: "2100000000",
      collateralType: "Hàng hóa / kho hàng",
      estimatedCollateralVnd: "15000000000",
      status: "escalated",
      assignedToId: "emp-credit-f",
      assignedAt: new Date("2026-07-18T02:15:00.000Z"),
      staffNote: "Khoản 12 tỷ — vượt hạn mức chi nhánh 5 tỷ.",
      submittedAt: new Date("2026-07-18T03:30:00.000Z"),
      submittedById: "emp-credit-f",
      decision: "escalated",
      decisionNote: "Chuyển cấp phê duyệt cao hơn do vượt hạn mức chi nhánh.",
      decidedAt: new Date("2026-07-18T04:15:00.000Z"),
      decidedById: "emp-mgr-d",
    },
    {
      id: "loan-req-edu-010",
      externalRef: "MOBILE-2026-0010",
      customerId: "cus-010",
      requestedAmountVnd: "350000000",
      loanPurpose: "Vay du học nước ngoài",
      requestedTermMonths: 72,
      declaredIncomeVnd: "48000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-reno-011",
      externalRef: "MOBILE-2026-0011",
      customerId: "cus-011",
      requestedAmountVnd: "800000000",
      loanPurpose: "Sửa chữa nhà ở",
      requestedTermMonths: 120,
      declaredIncomeVnd: "39000000",
      collateralType: "Bất động sản",
      estimatedCollateralVnd: "2500000000",
      status: "approved",
      assignedToId: "emp-credit-g",
      assignedAt: new Date("2026-07-18T02:30:00.000Z"),
      staffNote: "DTI ổn, tài sản bảo đảm đủ — đề nghị phê duyệt.",
      submittedAt: new Date("2026-07-18T03:40:00.000Z"),
      submittedById: "emp-credit-g",
      decision: "approved",
      decisionNote: "Phê duyệt trong hạn mức chi nhánh.",
      decidedAt: new Date("2026-07-18T04:30:00.000Z"),
      decidedById: "emp-mgr-d",
    },
    {
      id: "loan-req-consume-012",
      externalRef: "MOBILE-2026-0012",
      customerId: "cus-012",
      requestedAmountVnd: "200000000",
      loanPurpose: "Vay tiêu dùng tín chấp",
      requestedTermMonths: 36,
      declaredIncomeVnd: "28000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-land-013",
      externalRef: "MOBILE-2026-0013",
      customerId: "cus-013",
      requestedAmountVnd: "2500000000",
      loanPurpose: "Mua đất nền xây nhà",
      requestedTermMonths: 240,
      declaredIncomeVnd: "55000000",
      collateralType: "Quyền sử dụng đất",
      estimatedCollateralVnd: "3800000000",
      status: "needs_info",
      assignedToId: "emp-credit-b",
      assignedAt: new Date("2026-07-18T02:50:00.000Z"),
      staffNote: "Đã chạy đánh giá sơ bộ — trình duyệt.",
      submittedAt: new Date("2026-07-18T03:50:00.000Z"),
      submittedById: "emp-credit-b",
      decision: "returned",
      decisionNote: "Yêu cầu bổ sung giấy tờ định giá quyền sử dụng đất.",
      decidedAt: new Date("2026-07-18T04:45:00.000Z"),
      decidedById: "emp-mgr-d",
    },
    {
      id: "loan-req-logistics-014",
      externalRef: "MOBILE-2026-0014",
      customerId: "cus-015",
      requestedAmountVnd: "8000000000",
      loanPurpose: "Mua xe tải và mở rộng kho logistics",
      requestedTermMonths: 60,
      declaredIncomeVnd: "1500000000",
      collateralType: "Phương tiện / kho bãi",
      estimatedCollateralVnd: "11000000000",
      status: "assigned",
      assignedToId: "emp-credit-b",
      assignedAt: new Date("2026-07-18T02:45:00.000Z"),
    },
    {
      id: "loan-req-wedding-015",
      externalRef: "MOBILE-2026-0015",
      customerId: "cus-014",
      requestedAmountVnd: "150000000",
      loanPurpose: "Vay tiêu dùng ngắn hạn",
      requestedTermMonths: 24,
      declaredIncomeVnd: "31000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-moto-016",
      externalRef: "MOBILE-2026-0016",
      customerId: "cus-016",
      requestedAmountVnd: "80000000",
      loanPurpose: "Mua xe máy",
      requestedTermMonths: 36,
      declaredIncomeVnd: "22000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-home-017",
      externalRef: "MOBILE-2026-0017",
      customerId: "cus-017",
      requestedAmountVnd: "1800000000",
      loanPurpose: "Mua nhà thứ hai",
      requestedTermMonths: 240,
      declaredIncomeVnd: "52000000",
      collateralType: "Bất động sản",
      estimatedCollateralVnd: "2800000000",
      status: "assigned",
      assignedToId: "emp-credit-f",
      assignedAt: new Date("2026-07-18T05:00:00.000Z"),
    },
    {
      id: "loan-req-clinic-018",
      externalRef: "MOBILE-2026-0018",
      customerId: "cus-018",
      requestedAmountVnd: "500000000",
      loanPurpose: "Vay chi phí y tế",
      requestedTermMonths: 48,
      declaredIncomeVnd: "40000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "advised",
      assignedToId: "emp-credit-g",
      assignedAt: new Date("2026-07-18T05:10:00.000Z"),
    },
    {
      id: "loan-req-build-019",
      externalRef: "MOBILE-2026-0019",
      customerId: "cus-019",
      requestedAmountVnd: "25000000000",
      loanPurpose: "Thi công dự án nhà phố thương mại",
      requestedTermMonths: 60,
      declaredIncomeVnd: "4200000000",
      collateralType: "Quyền đòi nợ / công trình",
      estimatedCollateralVnd: "32000000000",
      status: "pending_approval",
      assignedToId: "emp-credit-b",
      assignedAt: new Date("2026-07-18T05:20:00.000Z"),
      staffNote: "DN xây dựng An Phát — khoản 25 tỷ, vượt hạn mức chi nhánh.",
      submittedAt: new Date("2026-07-18T06:00:00.000Z"),
      submittedById: "emp-credit-b",
    },
    {
      id: "loan-req-solar-020",
      externalRef: "MOBILE-2026-0020",
      customerId: "cus-020",
      requestedAmountVnd: "900000000",
      loanPurpose: "Lắp đặt điện mặt trời mái nhà",
      requestedTermMonths: 96,
      declaredIncomeVnd: "36000000",
      collateralType: "Thiết bị / bất động sản",
      estimatedCollateralVnd: "1200000000",
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-wedding-021",
      externalRef: "MOBILE-2026-0021",
      customerId: "cus-021",
      requestedAmountVnd: "250000000",
      loanPurpose: "Vay tiêu dùng cưới hỏi",
      requestedTermMonths: 36,
      declaredIncomeVnd: "30000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "assigned",
      assignedToId: "emp-credit-f",
      assignedAt: new Date("2026-07-18T05:30:00.000Z"),
    },
    {
      id: "loan-req-outscope-022",
      externalRef: "MOBILE-2026-0022",
      customerId: "cus-022",
      requestedAmountVnd: "400000000",
      loanPurpose: "Mua ô tô cũ",
      requestedTermMonths: 48,
      declaredIncomeVnd: "27000000",
      collateralType: "Ô tô",
      estimatedCollateralVnd: "550000000",
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-shop-023",
      externalRef: "MOBILE-2026-0023",
      customerId: "cus-023",
      requestedAmountVnd: "1200000000",
      loanPurpose: "Mở rộng cửa hàng bán lẻ",
      requestedTermMonths: 60,
      declaredIncomeVnd: "65000000",
      collateralType: "Bất động sản",
      estimatedCollateralVnd: "2000000000",
      status: "pending_approval",
      assignedToId: "emp-credit-g",
      assignedAt: new Date("2026-07-18T05:40:00.000Z"),
      staffNote: "Doanh thu ổn định 12 tháng — đề nghị phê duyệt trong hạn mức.",
      submittedAt: new Date("2026-07-18T06:15:00.000Z"),
      submittedById: "emp-credit-g",
    },
    {
      id: "loan-req-food-024",
      externalRef: "MOBILE-2026-0024",
      customerId: "cus-024",
      requestedAmountVnd: "7000000000",
      loanPurpose: "Nâng cấp dây chuyền thực phẩm đông lạnh",
      requestedTermMonths: 72,
      declaredIncomeVnd: "1800000000",
      collateralType: "Máy móc / nhà xưởng",
      estimatedCollateralVnd: "9500000000",
      status: "assigned",
      assignedToId: "emp-credit-b",
      assignedAt: new Date("2026-07-18T05:50:00.000Z"),
    },
    {
      id: "loan-req-refi-025",
      externalRef: "MOBILE-2026-0025",
      customerId: "cus-001",
      requestedAmountVnd: "500000000",
      loanPurpose: "Tái cấp vốn khoản vay tiêu dùng",
      requestedTermMonths: 36,
      declaredIncomeVnd: "45000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "approved",
      assignedToId: "emp-credit-b",
      assignedAt: new Date("2026-07-17T01:00:00.000Z"),
      staffNote: "KH hiện hữu, lịch sử trả nợ tốt.",
      submittedAt: new Date("2026-07-17T08:00:00.000Z"),
      submittedById: "emp-credit-b",
      decision: "approved",
      decisionNote: "Phê duyệt hạn mức tái cấp vốn.",
      decidedAt: new Date("2026-07-17T10:00:00.000Z"),
      decidedById: "emp-mgr-d",
    },
    {
      id: "loan-req-equip-026",
      externalRef: "MOBILE-2026-0026",
      customerId: "cus-005",
      requestedAmountVnd: "350000000",
      loanPurpose: "Mua thiết bị văn phòng",
      requestedTermMonths: 24,
      declaredIncomeVnd: "28000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-agri-027",
      externalRef: "MOBILE-2026-0027",
      customerId: "cus-006",
      requestedAmountVnd: "2200000000",
      loanPurpose: "Vay sản xuất nông nghiệp công nghệ cao",
      requestedTermMonths: 48,
      declaredIncomeVnd: "42000000",
      collateralType: "Quyền sử dụng đất nông nghiệp",
      estimatedCollateralVnd: "3000000000",
      status: "advised",
      assignedToId: "emp-credit-f",
      assignedAt: new Date("2026-07-18T06:00:00.000Z"),
    },
    {
      id: "loan-req-travel-028",
      externalRef: "MOBILE-2026-0028",
      customerId: "cus-007",
      requestedAmountVnd: "120000000",
      loanPurpose: "Vay du lịch gia đình",
      requestedTermMonths: 18,
      declaredIncomeVnd: "35000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "rejected",
      assignedToId: "emp-credit-g",
      assignedAt: new Date("2026-07-17T02:00:00.000Z"),
      staffNote: "Mục đích tiêu dùng không ưu tiên.",
      submittedAt: new Date("2026-07-17T09:00:00.000Z"),
      submittedById: "emp-credit-g",
      decision: "rejected",
      decisionNote: "Từ chối — ưu tiên vốn cho nhu cầu thiết yếu và sản xuất.",
      decidedAt: new Date("2026-07-17T11:00:00.000Z"),
      decidedById: "emp-mgr-d",
    },
    {
      id: "loan-req-warehouse-029",
      externalRef: "MOBILE-2026-0029",
      customerId: "cus-008",
      requestedAmountVnd: "4500000000",
      loanPurpose: "Xây kho hàng trung chuyển",
      requestedTermMonths: 84,
      declaredIncomeVnd: "120000000",
      collateralType: "Bất động sản",
      estimatedCollateralVnd: "6000000000",
      status: "pending_approval",
      assignedToId: "emp-credit-b",
      assignedAt: new Date("2026-07-18T06:10:00.000Z"),
      staffNote: "Trong hạn mức 5 tỷ — đề nghị phê duyệt có điều kiện LTV ≤ 70%.",
      submittedAt: new Date("2026-07-18T07:00:00.000Z"),
      submittedById: "emp-credit-b",
    },
    {
      id: "loan-req-trade-030",
      externalRef: "MOBILE-2026-0030",
      customerId: "cus-009",
      requestedAmountVnd: "6000000000",
      loanPurpose: "Thư tín dụng L/C nhập khẩu",
      requestedTermMonths: 12,
      declaredIncomeVnd: "2100000000",
      collateralType: "Hàng hóa ký quỹ",
      estimatedCollateralVnd: "7500000000",
      status: "escalated",
      assignedToId: "emp-credit-f",
      assignedAt: new Date("2026-07-17T03:00:00.000Z"),
      staffNote: "L/C 6 tỷ — vượt hạn mức chi nhánh.",
      submittedAt: new Date("2026-07-17T12:00:00.000Z"),
      submittedById: "emp-credit-f",
      decision: "escalated",
      decisionNote: "Chuyển hội sở phê duyệt hạn mức ngoại thương.",
      decidedAt: new Date("2026-07-17T14:00:00.000Z"),
      decidedById: "emp-mgr-d",
    },
    {
      id: "loan-req-study-031",
      externalRef: "MOBILE-2026-0031",
      customerId: "cus-010",
      requestedAmountVnd: "280000000",
      loanPurpose: "Học phí đại học trong nước",
      requestedTermMonths: 48,
      declaredIncomeVnd: "48000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
    {
      id: "loan-req-furniture-032",
      externalRef: "MOBILE-2026-0032",
      customerId: "cus-011",
      requestedAmountVnd: "180000000",
      loanPurpose: "Mua nội thất nhà mới",
      requestedTermMonths: 36,
      declaredIncomeVnd: "39000000",
      collateralType: null,
      estimatedCollateralVnd: null,
      status: "assigned",
      assignedToId: "emp-credit-g",
      assignedAt: new Date("2026-07-18T06:20:00.000Z"),
    },
    {
      id: "loan-req-franchise-033",
      externalRef: "MOBILE-2026-0033",
      customerId: "cus-012",
      requestedAmountVnd: "1500000000",
      loanPurpose: "Nhượng quyền quán cà phê",
      requestedTermMonths: 60,
      declaredIncomeVnd: "28000000",
      collateralType: "Bất động sản thuê dài hạn",
      estimatedCollateralVnd: "2000000000",
      status: "needs_info",
      assignedToId: "emp-credit-f",
      assignedAt: new Date("2026-07-18T06:30:00.000Z"),
      staffNote: "Đã đánh giá sơ bộ — trình duyệt.",
      submittedAt: new Date("2026-07-18T07:20:00.000Z"),
      submittedById: "emp-credit-f",
      decision: "returned",
      decisionNote: "Bổ sung hợp đồng nhượng quyền và dự báo dòng tiền 24 tháng.",
      decidedAt: new Date("2026-07-18T08:00:00.000Z"),
      decidedById: "emp-mgr-d",
    },
    {
      id: "loan-req-plot-034",
      externalRef: "MOBILE-2026-0034",
      customerId: "cus-013",
      requestedAmountVnd: "3200000000",
      loanPurpose: "Mua đất xây xưởng nhỏ",
      requestedTermMonths: 180,
      declaredIncomeVnd: "55000000",
      collateralType: "Quyền sử dụng đất",
      estimatedCollateralVnd: "4500000000",
      status: "advised",
      assignedToId: "emp-credit-b",
      assignedAt: new Date("2026-07-18T06:40:00.000Z"),
    },
    {
      id: "loan-req-working-035",
      externalRef: "MOBILE-2026-0035",
      customerId: "cus-015",
      requestedAmountVnd: "3500000000",
      loanPurpose: "Vốn lưu động quý cao điểm",
      requestedTermMonths: 12,
      declaredIncomeVnd: "1500000000",
      collateralType: "Hàng tồn kho",
      estimatedCollateralVnd: "4000000000",
      status: "unassigned",
      assignedToId: null,
      assignedAt: null,
    },
  ];

  // Seed ở trạng thái test sạch: chia đều toàn bộ hồ sơ cho 3 chuyên viên,
  // chưa chạy AI và chưa đi qua maker-checker để người dùng test từng hồ sơ.
  const creditOfficerIds = ["emp-credit-b", "emp-credit-f", "emp-credit-g"];
  await prisma.loanRequest.updateMany({
    where: { bankCode },
    data: { assessmentTaskRunId: null },
  });
  await prisma.taskRun.deleteMany({ where: { bankCode } });

  for (const [index, row] of rows.entries()) {
    const assignedToId = creditOfficerIds[index % creditOfficerIds.length];
    const assignedAt = new Date(
      Date.UTC(2026, 6, 18, 1, index),
    );
    const cleanWorkflow = {
      status: "assigned",
      assignedToId,
      assignedAt,
      assessmentTaskRunId: null,
      assessmentStartedAt: null,
      assessmentTag: null,
      staffNote: null,
      submittedAt: null,
      submittedById: null,
      decision: null,
      decisionNote: null,
      decidedAt: null,
      decidedById: null,
    };
    await prisma.loanRequest.upsert({
      where: { externalRef: row.externalRef },
      update: {
        customerId: row.customerId,
        requestedAmountVnd: row.requestedAmountVnd,
        loanPurpose: row.loanPurpose,
        requestedTermMonths: row.requestedTermMonths,
        declaredIncomeVnd: row.declaredIncomeVnd,
        collateralType: row.collateralType,
        estimatedCollateralVnd: row.estimatedCollateralVnd,
        ...cleanWorkflow,
      },
      create: {
        id: row.id,
        externalRef: row.externalRef,
        customerId: row.customerId,
        requestedAmountVnd: row.requestedAmountVnd,
        loanPurpose: row.loanPurpose,
        requestedTermMonths: row.requestedTermMonths,
        declaredIncomeVnd: row.declaredIncomeVnd,
        collateralType: row.collateralType,
        estimatedCollateralVnd: row.estimatedCollateralVnd,
        ...cleanWorkflow,
        bankCode,
        source: "mobile_app",
        note: "Yêu cầu vay giả lập nhận từ API ứng dụng ngân hàng",
      },
    });
  }

  return rows.length;
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
  const employeeIds = await seedEmployees(bankCode);
  const customers = await seedCustomers(bankCode);
  const portfolioCount = await seedPortfolios(bankCode, customers);
  const knowledgeCount = await seedKnowledge(bankCode);
  const loanRequestCount = await seedLoanRequests(bankCode);

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
    loanRequests: loanRequestCount,
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
