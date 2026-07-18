import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const counts = {
    employees: await prisma.employee.count(),
    customers: await prisma.customer.count(),
    portfolios: await prisma.customerPortfolio.count(),
    knowledgeDocuments: await prisma.knowledgeDocument.count(),
    documentRelations: await prisma.documentRelation.count(),
    automations: await prisma.automation.count(),
  };
  console.log(JSON.stringify(counts, null, 2));
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
