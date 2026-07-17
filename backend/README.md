# Auco AI — NestJS Backend

Digital Expert Agents backend. Phases 1–3: NestJS + Prisma + Postgres/pgvector + Redis + **LLM gateway**, Railway-ready.

## Local

```bash
# 1. Infra (host ports 5433 / 6380 to avoid local conflicts)
npm run docker:up

# 2. Env
cp .env.example .env
# Fill OPENAI_API_KEY (required for agents) + optional GEMINI_API_KEY (fallback)

# 3. Migrate + generate + seed (Phase 2 — mock từ Frontend)
npx prisma migrate deploy
npm run prisma:seed

# 4. Dev server (port 8387)
npm run start:dev
```

Health: [http://localhost:8387/health](http://localhost:8387/health)

```json
{
  "status": "ok",
  "checks": {
    "database": "up",
    "redis": "up",
    "llm": { "primary": "configured", "fallback": "configured" }
  }
}
```

### Phase 3 — LLM gateway

| Endpoint | Mục đích |
|---|---|
| `GET /api/llm/status` | Primary/fallback model + key configured? |
| `POST /api/llm/smoke` | Tiny `generateObject` (non-prod, or `LLM_SMOKE_ENABLED=true`) |

Behavior (§5.4 README):

- Default: OpenAI (`DEFAULT_LLM_MODEL`, default `gpt-4o`)
- On 429 / 5xx / timeout → retry primary → fallback Gemini
- Trace: `{ provider, model, attempt, errorCode, usedFallback }`
- No BYOK / no per-agent model

## Railway deploy

1. New project → add **PostgreSQL** + **Redis**.
2. New service, image `mankhb2k/auco-ai` (or Dockerfile Root Directory `backend`).
3. Variables:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres private URL |
| `REDIS_URL` | Yes | Redis |
| `CORS_ORIGINS` | Yes | Vercel FE URL(s) |
| `OPENAI_API_KEY` | Yes (Phase 3+) | Primary LLM |
| `GEMINI_API_KEY` | Optional | Fallback LLM |
| `DEFAULT_LLM_MODEL` | Optional | default `gpt-4o` |
| `FALLBACK_LLM_MODEL` | Optional | default `gemini-2.0-flash` |
| `LLM_SMOKE_ENABLED` | Optional | `true` to allow `POST /api/llm/smoke` in prod |
| `PORT` | Auto | Railway |

Seed from laptop:

```bash
npm run prisma:seed:railway
```

## Phase map

| Done | Next |
|---|---|
| Phase 1 — Nest + Docker + Prisma + Redis | |
| Phase 2 — Seed từ FE mock | |
| Phase 3 — LLM gateway OpenAI + Gemini fallback | |
| Phase 4 — Planner / Orchestrator + TaskRun API | Phase 5 MCP Suite |
| | RAG, Approval, WS, Automations |

### Phase 4 API

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/task-runs` | Body: `{ goal, bankCode?, employeeId?, async? }`. Demo goals pin Credit‖Legal→Product; else LLM plan. Default awaits full run. |
| `GET` | `/api/task-runs` | List recent (`?limit=20`) |
| `GET` | `/api/task-runs/:id` | Detail + steps |

Demo goal examples (pinned DAG, no LLM required):

- Vay nhà: `"KH Nguyễn Văn An muốn vay mua nhà 2 tỷ"`
- DN: `"SHB Mekong vay 50 tỷ nhà máy — Thông tư 39"`
- FX: `"Trần Thị Bình nắm giữ USD lớn"`
