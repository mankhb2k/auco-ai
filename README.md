# Digital Expert Agents — Đội ngũ Chuyên gia AI cho Vận hành Ngân hàng

> Hack CX Together 2026 · Đề bài SHB  
> Repo triển khai: `auco-ai/` (`frontend/` + `backend/`)

### Ký hiệu trạng thái

| Ký hiệu | Ý nghĩa |
|---|---|
| **✅ Đã chốt** | Quyết định rõ, sẵn sàng implement |
| **🔜 Sprint kế tiếp** | Việc cần làm ngay, chưa code |
| **💡 Mở / sau demo** | Ý tưởng, không bắt buộc cho bản demo thi |

---

## 0. Quyết định đã chốt

| # | Quyết định | Lý do |
|---|---|---|
| 1 | **Backend: NestJS/TypeScript** (`backend/`), **Frontend: Next.js/React** (`frontend/`), **MCP server: process riêng** (thuộc ownership backend) | Giám khảo còn đánh giá năng lực triển khai/devops (nhiều service, Docker, orchestration thật) |
| 2 | **DB: PostgreSQL tự quản** (Docker Compose local → Railway khi deploy) + **pgvector** | Kiểm soát hạ tầng hoàn toàn; migration, seed, backup rõ ràng |
| 3 | **Deploy:** `backend/` (+ MCP servers) → Railway/Docker, `frontend/` → Vercel | Tách deploy đúng ranh giới team |
| 4 | **MCP là giao thức tool thật** (`@modelcontextprotocol/sdk`), mỗi hệ thống vận hành = **1 MCP server độc lập process** | Đúng yêu cầu đề bài về MCP; nhiều process = thêm điểm devops |
| 5 | **Không có quyền truy cập hệ thống SHB thật** — mock bằng dữ liệu công khai (SBV, chính sách công khai SHB) | Không có sandbox API từ ban tổ chức |
| 6 | Giữ **star topology qua Planner**, không mesh agent↔agent ở tầng cao — Specialist được **spawn worker tạm** trong phạm vi hẹp, có giới hạn (§2.3) | Tránh vòng lặp, dễ audit; vẫn đáp ứng “agent tự tạo multi-agent” |
| 7 | **Chỉ 2 phần: `frontend/` + `backend/`** — không monorepo packages, không Turborepo/pnpm workspace | Team FE/BE làm độc lập; nối qua REST + WebSocket |
| 8 | **RAG: LlamaIndex.TS** trong `backend/src/rag/`, **Vercel AI SDK** cho agent loop | Tách trách nhiệm rõ |
| 9 | **Không auth / không multi-user** trong bản demo — 1 phiên cố định, mở app là dùng | Không thuộc deliverable; dồn thời gian cho planner, MCP, RAG, Dashboard |
| 10 | **Multi-agent 2 tầng:** (1) Planner chia việc cho Specialist; (2) Specialist tự tạo worker tạm rồi tự tổng hợp (§2.3) | Đúng yêu cầu “agent chuyên gia tự tạo multi-agent” |
| 11 | **Không mesh linh hoạt** (CrewAI/AutoGen-style) | Ưu tiên quan sát / đánh giá / bảo mật (§7.5) |

**Đã cân nhắc và loại bỏ:**

- Next.js fullstack + Vercel + Supabase — loại vì giám khảo đánh giá devops
- Auth / multi-tenant — không thuộc deliverable
- Monorepo `packages/*` + Turborepo — tăng độ phức tạp khi FE/BE làm song song
- Mesh agent↔agent tự do — vòng lặp / khó audit; thay bằng fractal star có trần worker

---

## 1. Đề bài — tóm tắt

**Yêu cầu cốt lõi:** Hệ thống AI đa tác tử, mỗi tác tử = chuyên gia số một mảng nghiệp vụ (Tín dụng, Pháp chế & Tuân thủ, Sản phẩm, Vận hành). Agent phải: tự chủ lập kế hoạch, dùng tool/function calling, RAG chuyên biệt theo agent, cộng tác chéo, **thực thi hành động thật** trên hệ thống vận hành.

**Deliverables bắt buộc:**

1. Demo ≥ 2–3 chuyên gia số cộng tác giải 1 yêu cầu phức tạp
2. Cơ chế **planner agent** chia việc cho **executor agents**
3. Tool-use thật: gọi API / truy vấn dữ liệu / hành động cụ thể
4. **Dashboard** hiển thị trace agent, trạng thái nhiệm vụ, quyết định, luồng cộng tác
5. **So sánh** single-agent chatbot vs hệ thống multi-agent

---

## 2. Mô hình multi-agent đã chốt — Planner + Specialist + Worker

Topology: **planner-executor** + Specialist tự spawn worker. Hình sao lồng 1 cấp (fractal star) — không mesh.

**Ví dụ demo chính:**

> *"Khách hàng Nguyễn Văn A muốn vay 2 tỷ mua nhà, kiểm tra đủ điều kiện tín dụng không, có vướng quy định AML/tuân thủ không, sản phẩm vay nào phù hợp nhất, và tạo hồ sơ vận hành nếu đủ điều kiện."*

```text
Planner nhận goal → sinh TaskPlan (structured output, KHÔNG tự do văn bản):

  Step 1 [Credit Agent]      — song song ──┐   (Credit tự spawn ≤3 worker bên trong)
  Step 2 [Legal/Compliance]  — song song ──┼──► Step 4 [Product Agent]
                                            │      (chờ Step 1+2 xong)
                                            ▼
                              Step 5 [Operations Agent] — tạo hồ sơ
                              (CHỈ chạy nếu Step1=đạt AND Step2=không vướng)
                                            ▼
                              Step 6 [Planner] — tổng hợp trả lời user
```

### 2.1 Data model — `TaskRun` / `TaskStep`

```prisma
model TaskRun {
  id          String   @id @default(cuid())
  goal        String   @db.Text
  status      String                    // planning | running | done | failed
  planJson    Json
  finalAnswer String?  @db.Text
  createdAt   DateTime @default(now())
  steps       TaskStep[]
}

model TaskStep {
  id        String   @id @default(cuid())
  taskRunId String
  agentRole String                    // credit | legal | product | ops
  mode      String   @default("direct") // direct | spawn_workers
  input     Json
  output    Json?
  status    String                    // pending | running | waiting_approval | done | failed
  dependsOn String[]
  toolCalls Json[]   @default([])
  startedAt DateTime?
  finishedAt DateTime?
}
```

Bảng này vừa là engine chạy plan, vừa là nguồn dữ liệu duy nhất nuôi Dashboard — không trùng lặp state.

### 2.2 Luồng chạy

```text
1. User gửi goal → Planner (LLM) generateObject (Zod schema TaskPlan)
   → danh sách TaskStep + dependsOn
   → case demo chính: few-shot ghim TaskPlan đã validate (§2.4)
2. Orchestrator topological sort:
   - Step không phụ thuộc / phụ thuộc đã done → dispatch song song (concurrency cap)
   - Step còn phụ thuộc → giữ pending
3. Dispatch tới Specialist theo agentRole:
   - Specialist tự chọn DIRECT hoặc SPAWN WORKERS
   - Demo: Credit luôn SPAWN (≤3 worker → aggregate → output)
4. Side-effect thật → status = waiting_approval → chờ người duyệt
5. Mọi step done → Planner synthesize → câu trả lời cuối + trích dẫn
```

**Guardrail:** giới hạn số step tối đa / `TaskRun`, timeout mỗi step, turn budget.

### 2.3 Specialist tự tạo worker rồi tổng hợp

```text
Tầng 1 — PLANNER (điều phối liên phòng ban)
  User goal → chia TaskStep cho Credit / Legal / Product / Ops → synthesize

Tầng 2 — SPECIALIST (chuyên gia trong 1 nghiệp vụ)
  A) DIRECT: 1–2 tool/RAG đủ → làm luôn
  B) SPAWN WORKERS: ≤3 worker tạm song song → LLM aggregate → trả output đã gom
```

**Ví dụ Mode SPAWN — Credit Agent:**

```text
Credit Agent nhận: "Đánh giá khả năng vay 2 tỷ của KH Nguyễn Văn A"
  → spawn:
      Worker W1 ──► get_credit_score (MCP core-banking)     ─┐
      Worker W2 ──► get_transaction_history (MCP)            ─┼─► Credit Agent aggregate
      Worker W3 ──► check_loan_eligibility (MCP los) + RAG   ─┘
  → Trả Planner: { eligible, score, risks, citations, recommendation }
```

| Tên | Là gì | Sống bao lâu |
|---|---|---|
| **Planner** | Điều phối liên domain | Cả `TaskRun` |
| **Specialist** | Chuyên gia cố định (Credit/Legal/Product/Ops) | Seed sẵn / cả `TaskRun` |
| **Worker** | Agent tạm do Specialist tạo | **Chỉ trong 1 TaskStep** — xong thì huỷ |

**Giới hạn cứng:**

| Giới hạn | Giá trị |
|---|---|
| Ai được spawn | Chỉ Specialist — worker không spawn tiếp |
| Số worker / step | ≤ 3 |
| Ai quyết định Mode SPAWN | Specialist tự quyết |
| Side-effect | Worker chỉ đọc/phân tích; `mutates: true` → Specialist đề xuất → Approval |
| Demo chính | Credit Agent luôn SPAWN |

Không mesh Specialist↔Specialist: Credit không gọi thẳng Legal.

### 2.4 Kịch bản demo dựng sẵn

```text
1. Chọn cố định 1–2 goal chính cho demo
2. Chạy thử Planner nhiều lần → validate TaskPlan ổn định
3. Đưa TaskPlan đã validate vào few-shot system prompt
4. Case ngoài kịch bản vẫn chạy engine chung — chỉ kém ổn định hơn
```

---

## 3. MCP servers — mock hệ thống vận hành SHB

Mỗi hệ thống = **1 MCP server độc lập process**, transport stdio (local) hoặc SSE/Streamable HTTP (deploy). NestJS đóng vai MCP client.

| MCP server | Domain | Tool mock | Dữ liệu |
|---|---|---|---|
| `mcp-core-banking` | Credit, Ops | `get_account_balance`, `get_transaction_history`, `get_credit_score` | Postgres seed |
| `mcp-los` | Credit, Ops | `check_loan_eligibility`, `submit_loan_application` (⚠️ mutate) | Postgres seed |
| `mcp-compliance` | Legal | `run_aml_check`, `search_regulation`, `flag_transaction` (⚠️ mutate) | SBV công khai + embeddings |
| `mcp-product` | Product | `list_products`, `check_product_eligibility`, `compare_products` | Sản phẩm công khai SHB |
| `mcp-ops` | Ops | `create_service_ticket`, `get_ticket_status`, `assign_department` | Postgres seed |

Mỗi tool khai báo `mutates: boolean` — Orchestrator ép `waiting_approval` khi cần.

> **Ưu tiên demo:** `mcp-los` + `mcp-compliance`. 3 server còn lại có thể mock nông hơn nhưng giữ folder riêng.

---

## 4. RAG chuyên biệt theo agent — LlamaIndex.TS

| Quyết định | Lý do |
|---|---|
| **LlamaIndex.TS** | Mạnh ở ingest → chunk → embed → vector store |
| **Chỉ ingest + retrieval** | Agent loop / tool-calling giữ **Vercel AI SDK** |
| **Cách ly rủi ro** | Vấn đề LlamaIndex chỉ ảnh hưởng `backend/src/rag/` |

| Thành phần | Quyết định |
|---|---|
| Vector store | **pgvector** qua `PGVectorStore` |
| Namespace | Theo domain agent — không lẫn tri thức |
| Embedding | Together AI embedding API |
| Nguồn | Văn bản SBV công khai, chính sách/sản phẩm SHB công khai, quy trình mẫu |
| Citation | Mọi kết quả RAG kèm `{ sourceDoc, section, score }` |

```text
backend/src/rag/
  ingest.ts
  retrieve.ts
  embeddings/together.ts
  indexes.ts
```

RAG search expose thành MCP tool theo domain (`credit_kb_search`, `legal_kb_search`…).

```prisma
model KnowledgeDocument {
  id        String @id @default(cuid())
  domain    String   // credit | legal | product | ops
  title     String
  sourceUrl String?
  content   String @db.Text
  // vector do LlamaIndex PGVectorStore quản lý (không khai báo qua Prisma)
}
```

---

## 5. Agent framework & memory

### 5.1 Framework

| Framework | Quyết định |
|---|---|
| CrewAI / AutoGen | **Không dùng** — mesh/handoff khó audit |
| LangGraph.js | Defer sau demo |
| **Vercel AI SDK + orchestration tự kiểm soát** | **Chốt dùng** — state trong `TaskRun`/`TaskStep` |

### 5.2 Thư viện

| Nhu cầu | Thư viện |
|---|---|
| Agent loop, structured output, tool calling, streaming | Vercel AI SDK (`ai`) |
| RAG | LlamaIndex.TS |
| Vector store | PostgreSQL + pgvector |
| Backend API + WS | NestJS |
| Orchestration | `backend/src/planning/` |
| MCP | `@modelcontextprotocol/sdk` |

### 5.3 Memory

| Loại | Lưu ở đâu | TTL / kiểm soát |
|---|---|---|
| Short-term | `TaskRun` / `TaskStep` / `toolCalls` | Theo `TaskRun` |
| Working | Runtime Specialist/worker → ghi vào `TaskStep.output` | Không lưu riêng |
| Long-term domain | RAG + pgvector | Chỉ qua seed/ingest, có citation |
| Agent profile | Config seed: role, tools | Cố định trong demo |
| Learned memory | **Không làm trong demo** | Defer |

**Quy tắc demo:** không để agent tự ghi long-term; mọi kết luận nghiệp vụ phải có citation; worker memory không sống lâu; Dashboard đọc `TaskRun`/`TaskStep`.

---

## 6. Thực thi hành động có kiểm soát (Human-in-the-loop)

Nguyên tắc: *AI không tự quyết định thay người về hành động có tác động thật. Mọi quyết định cuối thuộc về con người.*

Bất kỳ `TaskStep` gọi tool `mutates: true`:

```text
Agent chuẩn bị action → dry-run → preview cho người duyệt
  → Duyệt → step done, tool thực thi trên mock DB
  → Từ chối → step failed, Planner điều chỉnh câu trả lời cuối
```

**Approval UI:** người duyệt thật cho case chính; có nút **"auto-approve demo mode"** dự phòng khi live demo.

---

## 7. Dashboard

Dữ liệu lấy từ `TaskRun`/`TaskStep`. Realtime qua WebSocket NestJS — push `task.step.updated` / `approval.updated`.

| Khu vực UI | Nội dung |
|---|---|
| **DAG view** | TaskStep dạng graph; expand worker lồng trong Specialist |
| **Timeline / trace** | Tool call, input/output, RAG citation, thời gian |
| **Approval panel** | Step `waiting_approval`, Duyệt/Từ chối, preview |
| **Final answer** | Câu trả lời tổng hợp + trích dẫn |
| **So sánh single vs multi** | Cùng 1 câu hỏi — thời gian, tool đúng, citation, hành động thật |

---

## 8. So sánh single-agent vs multi-agent

```text
Baseline single-agent:  1 agent, full tool, KHÔNG planner
Hệ thống multi-agent:   Planner + 4 Specialist

Cùng bộ N câu hỏi cross-functional → so sánh:
  - Tỷ lệ gọi đúng tool / đúng domain
  - Có trích dẫn hay bịa
  - Có hành động thật (audit) hay chỉ text
  - Thời gian phản hồi (multi chậm hơn — nói rõ trade-off)
```

---

## 9. Giám sát, Đánh giá & Bảo mật

### 9.1 Observability

| Tầng | Cơ chế |
|---|---|
| Trace orchestration | `TaskRun` / `TaskStep` / `toolCalls` / worker spawn → DB |
| Realtime | WebSocket events |
| Citation | RAG `{ sourceDoc, section, score }` |
| Audit side-effect | Mọi `mutates: true` qua Approval |
| Structured log | Pino/Nest: taskRunId, stepId, agentRole, tool, latency |

Dashboard chỉ đọc state đã persist — không vẽ ảo.

### 9.2 Evaluation

| Loại | Cách làm demo |
|---|---|
| A/B architecture | Single vs multi (§8) |
| Plan quality | Few-shot + Zod `TaskPlan` |
| RAG faithfulness | Citation bắt buộc; mẫu N case kiểm thủ công |
| Action safety | 100% mutate tools qua Approval |
| Latency / cost | Log token + wall-clock |

**Không làm trong demo:** LLM-as-judge tự động, regression suite lớn, online A/B traffic thật.

### 9.3 Security

| Hạng mục | Demo | Production SHB (thuyết trình) |
|---|---|---|
| AuthN/AuthZ | Bỏ | OIDC/SSO, RBAC, AgentGrant |
| Human-in-the-loop | Approval trước side-effect | Maker-checker, dual control |
| Tool allowlist | Specialist chỉ thấy tool đúng domain | Policy engine + least privilege |
| Secrets | `.env` / Railway secrets | Vault |
| Prompt injection | System prompt khóa domain; worker không mutate | Sanitization, DLP |
| Network | MCP tách process, Docker network | VPC, mTLS |
| Audit | `TaskStep` + Approval history | Immutable audit log |
| Data | Mock / văn bản công khai | Phân loại dữ liệu, PII policy |

---

## 10. Cấu trúc thư mục

```
auco-ai/
├── README.md
├── API.md                              # contract REST + WS
├── frontend/                           # Next.js — TEAM FRONTEND
│   ├── package.json
│   ├── app/ / components/ / hooks/ / stores/ / lib/
│   └── .env.example                    # NEXT_PUBLIC_API_URL=
│
└── backend/                            # NestJS — BACKEND
    ├── package.json
    ├── prisma/schema.prisma
    ├── src/
    │   ├── llm/
    │   ├── rag/
    │   ├── mcp-client/
    │   ├── planning/
    │   ├── agents/
    │   ├── approvals/
    │   └── realtime/
    ├── data/
    ├── docker-compose.yml
    ├── mcp-servers/
    │   ├── mcp-los/
    │   ├── mcp-compliance/
    │   ├── mcp-core-banking/
    │   ├── mcp-product/
    │   └── mcp-ops/
    └── .env.example
```

Không có `packages/`, Turborepo, hay pnpm workspace root. Mỗi bên `install` riêng.

### Endpoint tối thiểu (`API.md`)

| Method | Path | Mục đích |
|---|---|---|
| POST | `/api/task-runs` | Tạo TaskRun từ `goal` |
| GET | `/api/task-runs/:id` | Snapshot TaskRun + steps |
| POST | `/api/task-runs/:id/approve/:stepId` | Duyệt / từ chối |
| POST | `/api/compare` | Single vs multi |
| WS | `/api/ws/task-runs/:id` | Push realtime events |

### Làm việc song song FE ↔ BE

```text
Giai đoạn 1: FE mock theo API.md · BE dựng NestJS + Planner + MCP + RAG
Giai đoạn 2: FE trỏ NEXT_PUBLIC_API_URL → backend thật
```

---

## 11. Roadmap theo sprint

```text
Sprint 0 — Contract + skeleton
  Tạo frontend/ + backend/ (package.json riêng)
  Viết API.md · NestJS + Prisma + docker-compose Postgres
  FE: shell chat + entry thẳng (không auth)

Sprint 1 — Planner + mock
  BE: TaskRun/TaskStep + Planner + Specialist Credit mock
  FE: gắn mock TaskRun · Ghim kịch bản demo (§2.4)

Sprint 2 — MCP + RAG + Dashboard
  BE: mcp-los + mcp-compliance; LlamaIndex RAG; seed knowledge
  FE: DAG / timeline / approval

Sprint 3 — DAG đầy đủ + spawn workers + Approval
  Dispatch song song + dependsOn + waiting_approval + WS

Sprint 4 — So sánh single vs multi + polish Dashboard

Sprint 5 — Devops + demo script
  Docker Compose full stack · FE Vercel · Script 1–2 case chính
```

---

## 12. Việc chưa chốt / còn bỏ dở

| # | Câu hỏi | Trạng thái |
|---|---|---|
| 1 | Mức độ DAG: cố định 4–5 step hay agent tự sinh động? | ✅ Đã chốt — Planner `generateObject` thật + few-shot ghim case demo (§2.4) |
| 2 | Approval: người thật bấm duyệt hay auto-approve? | 💡 mở — gợi ý: người thật cho case chính, có nút demo-mode dự phòng |
| 3 | Multi-user/auth trong demo? | ✅ Đã chốt: **bỏ auth** |
| 4 | Số MCP server thực sự dựng: cả 5 hay 2–3 đủ? | 💡 mở — ưu tiên `mcp-los` + `mcp-compliance`; còn lại mock nông |
| 5 | Nguồn văn bản SBV/SHB công khai cụ thể cho RAG? | 🔜 cần tổng hợp danh sách link trước Sprint 2 |
| 6 | Specialist nào dùng Mode SPAWN trong demo chính? | ✅ Đã chốt: **Credit Agent** luôn spawn ≤3 worker |
| 7 | LlamaIndex.TS / PGVectorStore adapter ổn định chưa? | 🔜 cần spike ngắn Sprint 0 — fallback: tự viết retrieval mỏng trên pgvector |
| 8 | UI Dashboard: CSS Modules hay Tailwind cho panel mới? | 💡 mở — chọn theo tốc độ team FE |
| 9 | Payload chi tiết Zod/JSON Schema trong `API.md` | 🔜 chốt trước khi FE dựng mock sâu |
| 10 | Scaffold `frontend/` + `backend/` + Docker Compose | 🔜 chưa có code |
| 11 | Seed khách hàng / sản phẩm / quy định mock | 🔜 chưa làm |
| 12 | Eval harness single vs multi (`POST /api/compare`) | 🔜 Sprint 4 |

---

## 13. Q&A Giám khảo — lựa chọn công nghệ & kiến trúc

### 13.1 Câu trả lời mở đầu

> Các công nghệ trong đề là **gợi ý**, tiêu chí cốt lõi là năng lực hệ thống: lập kế hoạch, phối hợp đa tác tử, RAG, tool use, MCP, thực thi hành động, human-in-the-loop và quan sát được toàn bộ trace. Nhóm chọn công nghệ tương đương phù hợp với năng lực TypeScript để dành thời gian giải quyết nghiệp vụ ngân hàng. Mỗi lựa chọn được cô lập sau contract chuẩn (MCP, Zod), nên không khóa hệ thống vào một framework.

Ba tiêu chí nhấn mạnh:

1. **Tốc độ giao hàng** trong thời gian thi
2. **Khả năng kiểm soát** — plan có schema, audit, approval, state bền vững
3. **Khả năng thay thế** — MCP, REST/WS, Zod giữ lõi không phụ thuộc framework

### 13.2 “Tại sao không dùng FastAPI mà dùng NestJS?”

> FastAPI phù hợp hệ sinh thái AI Python. Đội ngũ mạnh TypeScript và NestJS đã có sẵn REST, WebSocket, Prisma, logging, Docker. Một ngôn ngữ xuyên suốt frontend, backend, MCP server giảm lỗi contract. Model provider, LlamaIndex và MCP đều có SDK TypeScript. Nếu SHB yêu cầu Python, MCP server và API contract cho phép thay service orchestration mà không đổi frontend.

### 13.3 “Tại sao không dùng LangGraph?”

> LangGraph mạnh cho workflow có state và checkpoint. Với phạm vi demo, nhóm cần DAG nhỏ nhưng lưu từng bước vào PostgreSQL, hiển thị Dashboard và dừng đúng tại phê duyệt — nên triển khai state machine miền nghiệp vụ bằng `TaskRun`/`TaskStep` với Zod. Audit trail và approval là dữ liệu hạng nhất. Nếu workflow phức tạp hơn sau này, LangGraph có thể thay executor phía sau mà không đổi `TaskPlan`, MCP hay UI.

### 13.4 “Tại sao không dùng CrewAI/AutoGen? Không mesh thì có đúng đề bài không?”

> CrewAI/AutoGen phù hợp mesh hội thoại linh hoạt. Trong ngân hàng, mesh agent-to-agent tăng nguy cơ vòng lặp, chi phí token và khó truy nguyên. Nhóm chọn topology hình sao: Planner giao việc; Specialist tạo tối đa ba worker trong một tầng con. Đề bài yêu cầu **năng lực** (planning, tool use, RAG, cộng tác, hành động, MCP, dashboard) — không bắt buộc mesh. Fractal star đáp ứng đủ và khớp hơn với giám sát / đánh giá / bảo mật. “Cộng tác” = nhiều chuyên gia cùng giải yêu cầu liên chức năng dưới planner, không phải mọi agent gọi lẫn nhau.

### 13.5 “Tại sao dùng Vercel AI SDK cho agent loop?”

> Vercel AI SDK cung cấp streaming, structured output, tool calling và nhiều model provider trong TypeScript. Nhóm dùng nó như lớp gọi model mỏng — planning, policy, approval và persistence do domain layer kiểm soát. Đổi Together AI sang OpenAI/Claude/model nội bộ SHB không đổi kiến trúc điều phối.

### 13.6 “Tại sao LlamaIndex.TS thay vì tự viết RAG hoặc LangChain?”

> Giá trị cần chứng minh là RAG chuyên biệt theo nghiệp vụ, có citation và kiểm soát nguồn — không phải tự viết chunking. LlamaIndex chỉ dùng trong `backend/src/rag`; agent loop vẫn Vercel AI SDK. Dự phòng: giữ LlamaIndex cho loading/chunking, query pgvector bằng repository mỏng nếu adapter không ổn.

### 13.7 “Tại sao PostgreSQL + pgvector, không dùng vector DB chuyên dụng?”

> Demo quy mô nhỏ; yêu cầu quan trọng hơn là transaction, audit và liên kết citation với task. PostgreSQL vừa lưu orchestration vừa hỗ trợ vector search — giảm một hệ thống vận hành. Ranh giới `backend/src/rag` cho phép chuyển Qdrant/Pinecone/vector store nội bộ SHB sau này.

### 13.8 “Tại sao MCP server phải tách process? Gọi REST trực tiếp có đơn giản hơn không?”

> REST đơn giản hơn cho demo, nhưng MCP tạo contract chuẩn để agent khám phá và gọi công cụ độc lập framework/model. Tách LOS, Compliance, Core Banking thành MCP server riêng mô phỏng ranh giới hệ thống ngân hàng, cô lập credential/policy, cho phép triển khai on-prem từng connector. NestJS chỉ là MCP client. MCP là **adapter an toàn cho agent** nằm trước REST/gRPC hiện hữu — không thay thế toàn bộ API ngân hàng.

### 13.9 “Tại sao Next.js thay vì React thuần?”

> Next.js vẫn là React, có routing/bundling/deploy sẵn. Dashboard là frontend mỏng — gọi REST và nhận WebSocket từ NestJS; business logic agent không nằm trong Next.js.

### 13.10 “Frontend xây thế nào? Tailwind hay CSS Modules?”

> Frontend là Next.js app độc lập: shell chat + Dashboard (DAG, approval, so sánh). Không auth/landing. Style chọn theo tốc độ team (CSS Modules hoặc Tailwind cho panel mới) — miễn nhất quán và chạy được trên desktop/mobile.

### 13.11 “Tại sao tách nhiều service — có over-engineer không?”

> Chỉ tách ở ranh giới có ý nghĩa: frontend, orchestration API, connector MCP. Repo không monorepo packages — chỉ `frontend/` + `backend/`. Bên trong API vẫn modular monolith, chưa tách từng agent thành microservice. Nếu thiếu thời gian, chỉ `mcp-los` và `mcp-compliance` đầy đủ; connector khác cùng contract nhưng mock nông.

### 13.12 “Tại sao không dùng monorepo packages chia sẻ type?”

> Mục tiêu cuộc thi là FE và BE làm song song rồi nối API. Shared TypeScript package buộc cùng toolchain/workspace, tăng conflict và setup. Contract HTTP/WS trong `API.md` đủ để FE mock và BE implement độc lập; khi nối chỉ đổi base URL.

### 13.13 “Tại sao không làm authentication?”

> Auth không nằm trong deliverable và không chứng minh năng lực multi-agent. Demo môi trường cô lập, dữ liệu giả lập — nhóm bỏ auth để đầu tư planner, RAG, MCP, approval và trace. Production với SHB: authN/AuthZ, RBAC, service identity, vault và audit theo người dùng là bắt buộc trước khi cho phép side-effect.

### 13.14 “Kiến trúc có khóa vào Together AI hay cloud công cộng không?”

> Không. Model provider nằm sau `backend/src/llm`; tool sau MCP; retrieval sau `backend/src/rag`. Có thể thay bằng model gateway hoặc model nội bộ SHB. Production có thể đặt API, PostgreSQL, MCP và model trong hạ tầng ngân hàng mà không đổi contract ứng dụng.

### 13.15 “Production-ready chưa?”

> Bản demo chứng minh đúng các **seam kiểm soát** ngân hàng cần: trace end-to-end, approval trước hành động, tool allowlist, citation, ranh giới MCP. Auth/RBAC/Vault là lớp tích hợp hạ tầng SHB — nhóm cố ý không làm trong hackathon để dồn effort vào multi-agent + action execution, nhưng kiến trúc đã chừa chỗ (không cần đập đi xây lại).

### 13.16 “Có tự tạo agent không?”

> Có — Specialist tự spawn worker (ephemeral agents) cho tác vụ song song, rồi tự tổng hợp. Không tạo vô hạn agent vĩnh viễn. Độ sâu tối đa = 1; ≤3 worker/step; worker không được mutate.

### 13.17 Câu kết khi bị hỏi dồn về stack

> Chúng tôi tối ưu cho **khả năng kiểm soát và khả năng thay thế**, không tối ưu để trình diễn số lượng framework. Phần có giá trị là plan có cấu trúc, collaboration có giới hạn, RAG có citation, action có approval và trace end-to-end. Stack hiện tại giúp chứng minh các năng lực đó ổn định trong thời gian thi, đồng thời giữ đường thay thế sang Python hoặc hạ tầng nội bộ SHB qua contract chuẩn.
