# Auco AI — NestJS Backend (Phase 1)

Digital Expert Agents backend. Phase 1: NestJS + Prisma + Postgres/pgvector + Redis, Railway-ready.

## Local

```bash
# 1. Infra (host ports 5433 / 6380 to avoid local conflicts)
npm run docker:up

# 2. Env
cp .env.example .env

# 3. Migrate + generate + seed
npx prisma migrate deploy
npm run prisma:seed

# 4. Dev server (port 8387)
npm run start:dev
```

Health: [http://localhost:8387/health](http://localhost:8387/health)

```json
{
  "status": "ok",
  "checks": { "database": "up", "redis": "up" }
}
```

## Railway deploy

1. New project → add **PostgreSQL** (+ enable `vector` extension if available) + **Redis**.
2. New service from this repo, **Root Directory = `backend`**.
3. Builder uses `Dockerfile` / `railway.json`.
4. Variables (from plugins + app):

| Variable | Source |
|---|---|
| `DATABASE_URL` | Railway Postgres |
| `REDIS_URL` | Railway Redis |
| `PORT` | Railway (auto) |
| `CORS_ORIGINS` | your Vercel FE URL(s), comma-separated |
| `NODE_ENV` | `production` |

5. Healthcheck path: `/health` (already in `railway.json`).
6. Entrypoint runs `prisma migrate deploy` then starts Nest.

Optional one-off seed after first deploy:

```bash
railway run npm run prisma:seed
```

## Phase map

| Done (Phase 1) | Next |
|---|---|
| Nest scaffold, CORS, `/health` | LLM gateway |
| Docker Compose Postgres + Redis | Planner / Orchestrator |
| Prisma schema + migrate + seed | MCP Suite, RAG, Approval, WS |
| Dockerfile + railway.json | Automations (BullMQ) |
