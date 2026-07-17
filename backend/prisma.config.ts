import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Resolve DB URL for local (.env) and Railway.
 * During `prisma generate` (Docker build) DATABASE_URL may be absent —
 * use a placeholder so generate succeeds; migrate/runtime still need a real URL.
 */
function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.DATABASE_PRIVATE_URL?.trim() ||
    process.env.DATABASE_PUBLIC_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRIVATE_URL?.trim() ||
    "";

  if (url) return url;

  // Placeholder only for prisma generate at image build time
  return "postgresql://build:build@127.0.0.1:5432/build?schema=public";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
