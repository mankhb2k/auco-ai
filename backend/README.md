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
| Phase 4 — Planner / Orchestrator + TaskRun API | |
| Phase 5 — SHB MCP Suite (los+compliance thật, 3 stub) | |
| Phase 6 — RAG hybrid (pgvector + FTS + citations) | |
| Phase 7 — Approval HITL + WebSocket | |
| Phase 8 — Automations (cron scan + run-now) | |
| Phase 9 — Compare single vs multi (`POST /api/compare`) | Done P0 backend |

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

### Phase 5 — SHB MCP Suite

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/mcp/suite` | Status “Connected: SHB MCP Suite” + connectors/tools |

Servers under `mcp-servers/` (stdio, `@modelcontextprotocol/sdk`):

| Server | Impl | Tools |
|---|---|---|
| `mcp-los` | real | `check_loan_eligibility`, `submit_loan_application`⚠️, `get_loan_application_status` |
| `mcp-compliance` | real | `run_aml_check`, `search_regulation`, `flag_transaction`⚠️ |
| `mcp-core-banking` | stub | `get_credit_score`, `get_transaction_history`, `get_account_balance` |
| `mcp-product` | stub | `list_products`, `check_product_eligibility`, `compare_products` |
| `mcp-ops` | stub | `create_service_ticket`⚠️, `get_ticket_status`, `assign_department` |

Nest gateway spawns stdio (compiled `dist/mcp-servers` or `tsx` in dev). Specialists call tools via allowlist — Credit spawn workers = real MCP.

### Phase 6 — RAG

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/rag/status` | Embedding provider |
| `POST` | `/api/rag/ingest` | Re-embed KnowledgeDocument → KnowledgeChunk (pgvector) |
| `POST` | `/api/rag/search` | `{ domain, query, includeSuperseded? }` → citations |

Hybrid: vector cosine + Postgres `ts_rank`; default filter `status=active`; join `DocumentRelation` notes. Specialists expose `credit_kb_search` / `legal_kb_search` in `TaskStep.toolCalls` (`mcp: "rag"`).
### Phase 7 — Approval + WebSocket

| Method | Path | Notes |
|---|---|---|
| GET | /api/approvals | Pending waiting_approval steps (?taskRunId=) |
| POST | /api/approvals/:stepId/approve | Execute pending mutate MCP tool, resume DAG |
| POST | /api/approvals/:stepId/reject | Fail step + TaskRun; no MCP side-effect |
| WS | 
amespace /ws | subscribe { taskRunId } → 	ask.updated / step.updated / pproval.needed |

Credit proposes submit_loan_application (no call until approve). Legal FX may propose lag_transaction. Ops proposes create_service_ticket.

### Phase 8 — Automations

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/automations` | List (+ recent runs) |
| `GET` | `/api/automations/:id` | Detail + run history |
| `PATCH` | `/api/automations/:id` | Toggle `enabled`, edit cron — agent never auto-enables |
| `POST` | `/api/automations/:id/run-now` | Manual run pinned graph |
| `GET` | `/api/automations/:id/runs` | AutomationRun list |

Scheduler: DB scan every 30s for `enabled && nextRunAt <= now`. Graph: trigger.cron → extract → llm-transform → notification. WS: `automation.run.updated`.

### Phase 9 — Compare (single vs multi)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/compare` | Body: `{ goal, bankCode? }` → `{ multi, single, verdict }` |

- **Multi:** Planner DAG (demo pin Credit‖Legal→Product), `skipApprovalPropose` so run finishes without HITL park; metrics still count Approval-gated mutates as `realActions`.
- **Single:** 1 baseline step, no Planner; MCP allowlist bypass (`skipAllowlist`); thin RAG; no mutate/Approval.
- Metrics align FE `CompareMetrics`: `latencyMs`, `toolAccuracy`, `citationCount`, `realActions`, `totalTokens`, `costUsd`, `notes` (+ `taskRunId`).
