# Digital Expert Agents — Đội ngũ Chuyên gia AI cho Vận hành Ngân hàng

> Hack CX Together 2026 · Đề bài SHB  
> Repo triển khai: `auco-ai/` (`frontend/` + `backend/`)  
> Tài liệu này chỉ chứa **kiến trúc đã chốt**, **Q&A**, và **phần chưa chốt**.

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
| 4 | **MCP là giao thức tool thật** (`@modelcontextprotocol/sdk`); sản phẩm gọi là **SHB MCP Suite**, bên trong chia capability/server (§3) | Đúng yêu cầu MCP; vừa kể được như feature kết nối SHB, vừa giữ isolation theo domain |
| 5 | **Không có quyền truy cập hệ thống SHB thật** — mock bằng dữ liệu công khai (SBV, chính sách công khai SHB) | Không có sandbox API từ ban tổ chức |
| 6 | Giữ **star topology qua Planner**, không mesh agent↔agent ở tầng cao — Specialist được **spawn worker tạm** trong phạm vi hẹp, có giới hạn (§2.3) | Tránh vòng lặp, dễ audit; vẫn đáp ứng “agent tự tạo multi-agent” |
| 7 | **Chỉ 2 phần: `frontend/` + `backend/`** — không monorepo packages, không Turborepo/pnpm workspace | Team FE/BE làm độc lập; nối qua REST + WebSocket |
| 8 | **RAG: LlamaIndex.TS** trong `backend/src/rag/`, **Vercel AI SDK** cho agent loop | Tách trách nhiệm rõ |
| 9 | **Không auth / không multi-user** trong bản demo — 1 phiên cố định, mở app là dùng | Không thuộc deliverable; dồn thời gian cho planner, MCP, RAG, Dashboard |
| 10 | **Multi-agent 2 tầng:** (1) Planner chia việc cho Specialist; (2) Specialist tự tạo worker tạm rồi tự tổng hợp (§2.3) | Đúng yêu cầu “agent chuyên gia tự tạo multi-agent” |
| 11 | **Không mesh linh hoạt** (CrewAI/AutoGen-style) | Ưu tiên quan sát / đánh giá / bảo mật (§9) |
| 12 | **Automation lặp lịch:** Agent đề xuất → user duyệt → **user bật/tắt**; scheduler (cron) chạy graph đã pin — tách khỏi `TaskRun` ad-hoc (§2.6) | Nhân viên ngân hàng cần báo cáo định kỳ đúng ngày; không nhét việc lặp vào chat một lần |
| 13 | **Không gộp tất cả tool vào một `shb-mcp` God service** — Suite = registry/gateway + nhiều MCP capability nhỏ | Bảo mật, audit side-effect, quyền hạn theo hệ thống; dễ plug connector ngân hàng khác |
| 14 | **Approval: người thật bấm Duyệt / Từ chối** — không auto-approve trong demo chính (§6) | Đúng human-in-the-loop; giám khảo thấy approval thật trên Dashboard |
| 15 | **DAG kịch bản demo: cố định 3 TaskStep chuyên gia** (ghim few-shot) — case ngoài kịch bản Planner vẫn `generateObject` động, có trần (§2.4) | Demo ổn định, đủ ≥2–3 chuyên gia theo đề bài; không để plan lệch lúc live |
| 16 | **MCP ưu tiên implement thật: `mcp-los` + `mcp-compliance`**; `core-banking` / `product` / `ops` = mock nông cùng contract (§3) | Đủ minh họa side-effect + RAG/compliance; giảm scope triển khai |
| 17 | **Planner điều phối theo Agent Catalog + Zod enum + validation + tool allowlist** — không “đoán tự do” (§2.5) | Tránh giao việc nhầm domain; sai routing bị chặn trước khi Specialist chạy |
| 18 | **LLM demo: OpenAI primary** (Planner + Specialist tool-calling); **Gemini fallback** khi rate-limit/lỗi; embedding tách provider (§5.4E) | Banking demo phụ thuộc structured plan + tool ổn định hơn “model nào giỏi ngân hàng hơn”; OpenAI chín hơn cho agent loop; Gemini rẻ/ổn làm dự phòng |

**Đã cân nhắc và loại bỏ:**

- Next.js fullstack + Vercel + Supabase — loại vì giám khảo đánh giá devops
- Auth / multi-tenant — không thuộc deliverable
- Monorepo `packages/*` + Turborepo — tăng độ phức tạp khi FE/BE làm song song
- Mesh agent↔agent tự do — vòng lặp / khó audit; thay bằng fractal star có trần worker
- Một MCP server khổng lồ chứa toàn bộ tool SHB — mất ranh giới hệ thống và audit
- Auto-approve làm mặc định demo — loại; chỉ người thật duyệt side-effect
- **User tự dán API key / BYOK per agent trong demo** — loại: conflict với không auth, rủi ro lộ key trên UI, không chứng minh multi-agent banking; để sau demo nếu làm SaaS

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

**Kịch bản demo chính — DAG cố định 3 chuyên gia** (✅ đã chốt):

```text
Planner nhận goal → TaskPlan ghim (few-shot), đúng 3 TaskStep:

  Step 1 [Credit Agent]      — song song ──┐   (Credit tự spawn ≤3 worker bên trong)
  Step 2 [Legal/Compliance]  — song song ──┘
                         │
                         ▼  (chờ Step 1+2 xong)
  Step 3 [Product Agent]     — đề xuất sản phẩm phù hợp
                         │
                         ▼
  Planner synthesize         — tổng hợp + citation (không tính là Specialist step)
```

Ops / tạo hồ sơ vận hành: nếu còn thời gian demo, gắn vào **Approval sau Step 3** (side-effect qua `mcp-los` / ticket mock) — không phình DAG kịch bản chính lên 4–5 step.

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
1. Chọn cố định 1 goal chính cho demo (ví dụ đầu §2)
2. TaskPlan demo: đúng 3 step — Credit ‖ Legal → Product
3. Chạy thử Planner nhiều lần → validate ổn định
4. Đưa TaskPlan đã validate vào few-shot system prompt
5. Case ngoài kịch bản: Planner vẫn generateObject động, nhưng:
   - agentRole chỉ trong enum { credit, legal, product, ops }
   - trần số step (ví dụ ≤ 5) + validation sau generate (§2.5)
```

### 2.5 Planner điều phối thế nào để không giao nhầm chuyên gia? ✅

Planner **không** đọc cảm tính rồi gọi agent. Điều phối dựa trên **catalog có schema + validation cứng** — LLM chỉ điền trong khung đã khóa.

#### (1) Agent Catalog — nguồn sự thật duy nhất

Seed cố định trong `backend/` (config, không do LLM tự bịa lúc runtime):

```ts
type AgentCapability = {
  role: "credit" | "legal" | "product" | "ops";
  displayName: string;
  mission: string;                 // 1 câu: chuyên gia làm gì / không làm gì
  intents: string[];               // tín hiệu: "vay", "AML", "biểu phí", "ticket"...
  capabilities: string[];          // "loan_eligibility", "aml_check", ...
  allowedMcp: string[];            // ["los", "core-banking"] | ["compliance"] | ...
  inputHints: string[];            // cần gì từ user/goal: customerId, amount, ...
  outputSchemaKey: string;         // schema Zod output bắt buộc trả về
};
```

| role | Mission (tóm tắt) | Capability / MCP |
|---|---|---|
| `credit` | Đánh giá khả năng vay, điểm tín dụng, lịch sử giao dịch | `loan_eligibility`, `credit_score` → los, core-banking |
| `legal` | AML/KYC, quy định SBV, flag giao dịch | `aml_check`, `regulation_search` → compliance |
| `product` | So sánh / đề xuất sản phẩm, biểu phí, lãi suất | `list_products`, `compare_products` → product |
| `ops` | Ticket vận hành, gán phòng ban, theo dõi hồ sơ | `create_ticket`, `assign_department` → ops |

Planner nhận **toàn bộ catalog** trong system prompt (hoặc tool `list_agents` chỉ đọc catalog) — không được invent role ngoài enum.

#### (2) Structured plan — Zod khóa `agentRole`

```ts
const TaskStepSchema = z.object({
  id: z.string(),
  agentRole: z.enum(["credit", "legal", "product", "ops"]), // không free-text
  goal: z.string().min(1),
  dependsOn: z.array(z.string()),
  requiredCapabilities: z.array(z.string()).optional(),
});
```

LLM không thể tạo `agentRole: "marketing"` hay `"general"` — schema reject trước khi persist.

#### (3) Validation sau `generateObject` (deterministic)

Trước khi Orchestrator dispatch:

| Check | Hành động nếu fail |
|---|---|
| `agentRole` ∈ catalog | Reject step / replan 1 lần |
| `requiredCapabilities` ⊆ capability của role đó | Reject — ví dụ Credit không nhận `aml_check` |
| `dependsOn` trỏ id tồn tại, không cycle | Reject plan |
| Số step ≤ trần (demo case = 3; off-script ≤ 5) | Cắt hoặc replan |
| Goal step không rỗng / không trùng domain vô lý | Warn + replan |

→ Điều phối nhầm bị **chặn bằng code**, không chỉ bằng prompt.

#### (4) Tool allowlist ở Specialist — lớp phòng thủ thứ hai

Dù Planner vẫn giao nhầm:

```text
Credit Agent chỉ được inject tool từ allowedMcp = [los, core-banking]
Legal chỉ thấy compliance tools
Product chỉ thấy product tools
```

Specialist **không có tool** của domain khác → không thể “làm thay” Legal dù bị giao nhầm. Dashboard vẫn hiện step fail rõ ràng (“role không khớp capability”).

#### (5) Demo: few-shot ghim plan 3 step

Case live chính không phụ thuộc LLM tự nghĩ DAG mỗi lần — few-shot ép đúng Credit ‖ Legal → Product. Off-script dùng (1)–(4).

#### Tóm tắt trả lời giám khảo

> Trợ lý điều phối (Planner) dựa vào **Agent Catalog** (mission, intent, capability, MCP allowlist), sinh **TaskPlan có schema Zod** (`agentRole` enum), rồi **validation deterministic** trước dispatch. Specialist chỉ nhận tool đúng domain — sai routing không lan thành sai hành động. Kịch bản demo còn được **ghim 3 step** bằng few-shot để ổn định thuyết trình.

### 2.6 Automation lặp lịch — Agent tạo, user bật/tắt, scheduler ✅

Nhu cầu kiểu *“nhân viên ngân hàng lấy thông tin mỗi tháng đúng ngày”* **không** nhét vào `TaskRun` ad-hoc. Đó là **Automation** — tầng riêng.

#### Hai loại việc

| | **TaskRun** | **Automation** |
|---|---|---|
| Kích hoạt | User chat 1 lần | **Lịch** (cron) hoặc *Chạy ngay* |
| Sống bao lâu | 1 yêu cầu → xong | **Đứng nền**, chạy lại định kỳ |
| Ai tạo | Planner + Specialist | **Agent đề xuất** → user duyệt → lưu |
| User kiểm soát | Approval từng side-effect | **Bật / tắt / sửa lịch / xóa** |
| Runtime | LLM mỗi step | Chạy lại **graph đã duyệt** — ít hoặc không LLM |

#### Luồng tạo Automation

```text
1. User: "Mỗi ngày 1 hàng tháng lúc 8h, gửi báo cáo rủi ro tín dụng tháng trước"
2. Agent nhận diện VIỆC LẶP → propose_automation
3. Ghép graph tool/capability:
      trigger.cron (0 8 1 * * · Asia/Ho_Chi_Minh)
      → extract (MCP: KH / giao dịch tháng trước)
      → llm-transform (tóm tắt rủi ro)
      → notification
4. Dry-run 1 lần → user xem preview
5. User duyệt → lưu Automation + version bất biến
6. User bật enabled = true  ← Agent KHÔNG tự bật
7. Scheduler đến đúng ngày → chạy version đã pin
8. Mỗi lần chạy = AutomationRun (trace riêng)
```

#### Model dữ liệu

```prisma
model Automation {
  id                 String   @id @default(cuid())
  name               String
  description        String?  @db.Text
  createdByAgentRole String                    // credit | ops | ...
  triggerType        String                    // schedule | manual
  cronExpr           String?                   // "0 8 1 * *"
  timezone           String   @default("Asia/Ho_Chi_Minh")
  enabled            Boolean  @default(false)  // user phải chủ động bật
  status             String                    // draft | pending_approval | active | paused
  botVersionId       String?
  lastRunAt          DateTime?
  nextRunAt          DateTime?
  createdAt          DateTime @default(now())
  runs               AutomationRun[]
}

model AutomationRun {
  id            String   @id @default(cuid())
  automationId  String
  status        String                    // running | done | failed
  startedAt     DateTime @default(now())
  finishedAt    DateTime?
  resultSummary String?  @db.Text
  traceJson     Json?
}
```

#### Scheduler

| Thành phần | Vai trò |
|---|---|
| BullMQ repeatable job / cron scan | `enabled=true` → enqueue khi đến `nextRunAt` |
| Worker | Chạy graph version đã pin (không gọi Planner LLM) |
| Kết quả | Ghi `AutomationRun` + WS `automation.run.updated` |

Demo: **1 automation mẫu** (báo cáo tháng) + nút *Chạy thử ngay*.

---

## 3. SHB MCP Suite — connector hệ thống vận hành ngân hàng ✅

Với giám khảo / nghiệp vụ, đóng gói thành **SHB MCP Suite** — feature kết nối hệ thống vận hành SHB. Bên trong suite chia theo capability/server.

```text
Agent Orchestrator (NestJS)
        ↓
MCP Registry / Connector Catalog
        ↓
SHB MCP Suite
  ├─ mcp-core-banking
  ├─ mcp-los
  ├─ mcp-compliance
  ├─ mcp-product
  └─ mcp-ops
```

Mỗi capability = **1 MCP server độc lập process**, `@modelcontextprotocol/sdk`, transport stdio (local) hoặc SSE/Streamable HTTP (deploy). NestJS = MCP client.

**Cách kể sản phẩm:** Digital Expert Agents kết nối **SHB MCP Suite**.  
**Cách implement:** không làm một MCP server khổng lồ; làm registry/gateway quản lý nhóm connector SHB, tool thật nằm trong MCP domain nhỏ.

| MCP server | Domain | Tool mock | Dữ liệu |
|---|---|---|---|
| `mcp-core-banking` | Credit, Ops | `get_account_balance`, `get_transaction_history`, `get_credit_score` | Postgres seed |
| `mcp-los` | Credit, Ops | `check_loan_eligibility`, `submit_loan_application` (⚠️ mutate) | Postgres seed |
| `mcp-compliance` | Legal | `run_aml_check`, `search_regulation`, `flag_transaction` (⚠️ mutate) | SBV công khai + embeddings |
| `mcp-product` | Product | `list_products`, `check_product_eligibility`, `compare_products` | Sản phẩm công khai SHB |
| `mcp-ops` | Ops | `create_service_ticket`, `get_ticket_status`, `assign_department` | Postgres seed |

Mỗi tool khai báo `mutates: boolean` — Orchestrator ép `waiting_approval` khi cần.

> **✅ Đã chốt phạm vi MCP:** implement thật `mcp-los` + `mcp-compliance`. `mcp-core-banking`, `mcp-product`, `mcp-ops` = mock nông / stub cứng, vẫn giữ folder + đăng ký trong SHB MCP Suite.

### 3.1 Vì sao không gộp thành một `shb-mcp`?

| Phương án | Đánh giá |
|---|---|
| Một MCP `shb-mcp` chứa hết tool | Dễ gọi tên lúc đầu; nhanh thành God service: quyền lẫn, lỗi lan domain, khó audit |
| Nhiều MCP rời, không registry | Đúng kỹ thuật nhưng câu chuyện sản phẩm vụn |
| **SHB MCP Suite = registry + capability MCP nhỏ** | **Chốt** — vừa feature, vừa isolation |

### 3.2 Mở rộng sang MCP ngân hàng khác

Thiết kế theo **capability registry**, không hard-code SHB vào agent:

```text
Bank Connector Registry
  ├─ bankCode: SHB
  │    ├─ capability: core-banking → mcp-core-banking-shb
  │    ├─ capability: los          → mcp-los-shb
  │    └─ capability: compliance   → mcp-compliance-shb
  ├─ bankCode: BANK_A
  │    └─ capability: core-banking → mcp-core-banking-bank-a
  └─ bankCode: BANK_B
       └─ capability: compliance   → mcp-compliance-bank-b
```

Agent chỉ yêu cầu capability (`core-banking.get_transaction_history`); registry resolve theo `bankCode` → connector normalize schema chung + giữ raw payload audit.

**Phản biện:** không hứa “đổi URL là nối mọi ngân hàng”. Chuẩn hóa được **capability contract**; mỗi ngân hàng vẫn cần adapter riêng (schema, sản phẩm, policy khác nhau).

### 3.3 Contract tối thiểu

```ts
type BankMcpConnector = {
  bankCode: string;                // SHB, BANK_A, ...
  capability: string;              // core-banking | los | compliance | product | ops
  serverName: string;              // mcp-los-shb
  transport: "stdio" | "sse" | "streamable-http";
  tools: Array<{
    name: string;
    mutates: boolean;
    requiresApproval: boolean;
    riskLevel: "low" | "medium" | "high";
  }>;
};
```

Registry dùng metadata để: allowlist theo domain agent, ép approval, hiện trace trên Dashboard, đăng ký thêm connector mock ngân hàng khác mà không sửa Planner.

### 3.4 Phạm vi demo

| Demo thi | Sau demo |
|---|---|
| Product feature: **SHB MCP Suite** | Registry nhiều ngân hàng |
| ✅ Implement thật **chỉ** `mcp-los` + `mcp-compliance` | Adapter đầy đủ core/product/ops |
| ✅ Stub nông `mcp-core-banking`, `mcp-product`, `mcp-ops` | Auth, vault, rate limit, per-bank SLA |
| Dashboard: “Connected: SHB MCP Suite” + tool trace | Connector health, permission matrix |

Thông điệp: **không hard-code agent vào SHB; SHB MCP Suite là connector đầu tiên; cùng kiến trúc gắn MCP ngân hàng khác qua capability registry.**

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
| Embedding | OpenAI hoặc Gemini embeddings (cùng họ với LLM primary nếu tiện) — cấu hình env |
| Nguồn | Văn bản SBV công khai, chính sách/sản phẩm SHB công khai, quy trình mẫu |
| Citation | Mọi kết quả RAG kèm `{ sourceDoc, section, score }` |

```text
backend/src/rag/
  ingest.ts
  retrieve.ts
  embeddings/          # wrap provider embedding (openai | gemini)
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
| Scheduler Automation | BullMQ (hoặc cron worker tương đương) |

### 5.3 Memory

| Loại | Lưu ở đâu | TTL / kiểm soát |
|---|---|---|
| Short-term | `TaskRun` / `TaskStep` / `toolCalls` | Theo `TaskRun` |
| Working | Runtime Specialist/worker → ghi vào `TaskStep.output` | Không lưu riêng |
| Long-term domain | RAG + pgvector | Chỉ qua seed/ingest, có citation |
| Agent profile | Config seed: role, tools | Cố định trong demo |
| Learned memory | **Không làm trong demo** | Defer |

**Quy tắc demo:** không để agent tự ghi long-term; mọi kết luận nghiệp vụ phải có citation; worker memory không sống lâu; Dashboard đọc `TaskRun`/`TaskStep` (+ `AutomationRun` nếu có).

### 5.4 LLM gateway — limit, lỗi API, API key theo agent ✅

Ba ý thường bị lẫn — tách rõ:

| Ý tưởng | Demo thi | Đánh giá |
|---|---|---|
| **A. Auto failover khi rate-limit / API lỗi** | ✅ Làm **mỏng** trong `backend/src/llm` | Cần thiết cho live demo ổn định |
| **B. Model/profile khác nhau theo agent** (Credit ≠ Legal) | 💡 Config env/seed — không bắt buộc UI | Hữu ích, không bắt buộc |
| **C. User tự kết nối API key riêng (BYOK) per agent** | ❌ **Không làm** trong demo | Không cần thiết cho đề bài; xung đột “không auth” |

#### A. Failover khi bị limit / API lỗi (nên có)

Không phải Planner “đổi chuyên gia” — đây là **LLM provider router** dưới tầng gọi model:

```text
callModel(agentRole, messages)
  → primary (OpenAI — §5.4E)
  → 429 / 5xx / timeout → retry có backoff (1–2 lần)
  → vẫn lỗi → fallback Gemini (nếu cấu hình)
  → ghi trace: { provider, model, attempt, errorCode }
  → hết fallback → step failed rõ trên Dashboard (không im lặng)
```

Phạm vi demo tối thiểu:

- Retry + 1 fallback model/provider từ **env platform**
- Log attempt trên `TaskStep.toolCalls` / structured log
- **Không** tự nhảy sang Specialist khác vì LLM lỗi (Credit lỗi ≠ giao Legal làm thay)

#### B. Model theo agent (optional)

```ts
// seed / env — platform quản lý; chi tiết model xem §5.4E
agentModelProfile = {
  planner: { provider: "openai", model: "gpt-4o" },
  credit:  { provider: "openai", model: "gpt-4o" },
  legal:   { provider: "openai", model: "gpt-4o" },
  product: { provider: "openai", model: "gpt-4o-mini" },
  ops:     { provider: "openai", model: "gpt-4o-mini" },
}
```

Điểm cộng thuyết trình: “mỗi chuyên gia có profile model phù hợp nhiệm vụ”. Không cần UI settings trong hackathon.

#### C. User BYOK / API key riêng từng agent — không cần thiết lúc này

| Lý do | Chi tiết |
|---|---|
| Đề bài không chấm | Deliverable = multi-agent, MCP, RAG, approval, dashboard — không phải key management |
| Conflict kiến trúc đã chốt | Demo **không auth** → không có “user của tôi” để gắn key an toàn |
| Bảo mật | Key trên browser / localStorage dễ lộ; banking demo càng xấu nếu lộ trên Dashboard |
| Vận hành SHB thật | Ngân hàng dùng **model gateway nội bộ / vault**, không để nhân viên dán OpenAI key vào từng agent |
| Chi phí phức tạp | UI settings, mã hóa key, rotate, quota per user — ăn thời gian multi-agent |

**Sau demo (nếu làm sản phẩm SaaS SMB):** BYOK + vault + auth là hợp lý. **Với SHB / hackathon:** platform key + gateway nội bộ là đúng.

#### D. Tầm nhìn ngân hàng thật — model / agent do tổ chức kiểm soát ✅

Ý đúng: **nhân viên không tự mang API key hay “agent riêng” vào vận hành.** Trong ngân hàng, chuyên gia số là **tài sản được duyệt** (giống phần mềm nội bộ), không phải đồ chơi cá nhân.

```text
Sai (không làm):
  Nhân viên dán OpenAI key → mỗi người một agent riêng → không audit, không thống nhất policy

Đúng (hướng SHB / production):
  Model Gateway nội bộ (hoặc VPC) → model được phê duyệt
       ↓
  Digital Expert Agents (catalog + RBAC + approval + MCP Suite)
       ↓
  Nhân viên chỉ dùng agent đã được cấp quyền — không tự cắm key
```

**“Train model riêng” — hay, nhưng nói đúng tầng:**

| Tầng | Ý nghĩa thực tế | Khi nào |
|---|---|---|
| **1. RAG + prompt + tool** (đang làm) | “Hiểu” nghiệp vụ SHB qua tài liệu + MCP, không cần train | **Demo / giai 1** |
| **2. Fine-tune / adapter** trên model nền | Giọng văn, format hồ sơ, thuật ngữ tín dụng–pháp chế | Sau khi có dữ liệu nội bộ đã duyệt |
| **3. Private / on-prem model** qua gateway | Llama/Qwen/model nội bộ trong VPC — không phụ thuộc cloud công cộng | Khi SHB yêu cầu data residency |
| **4. Train từ zero** | Hiếm, cực đắt, ít đội startup/hackathon làm | Thường **không** cần; fine-tune + RAG đủ hầu hết |

Thuyết trình nên nói:

> Chúng tôi không để nhân viên tự mang model/key cá nhân. Hệ thống chạy trên **model gateway do ngân hàng kiểm soát**; tri thức nghiệp vụ nằm ở RAG + MCP + approval. Khi SHB sẵn sàng, cùng contract `backend/src/llm` có thể trỏ sang **model nội bộ / fine-tune riêng** — không đập lại multi-agent.

**Không hứa trong hackathon:** đã train xong một foundation model riêng. **Có chừa chỗ:** LLM gateway + catalog agent = sẵn sàng gắn model riêng sau này.

#### E. Chọn API cho demo thi — OpenAI vs Gemini ✅

**Câu hỏi sai:** “Model nào giỏi nghiệp vụ ngân hàng hơn?”  
**Câu trả lời đúng:** Không model cloud công cộng nào “chuyên ngân hàng SHB”. Nghiệp vụ đến từ **RAG (SBV/SHB) + MCP + approval + catalog**. Model chỉ cần: lập plan ổn, gọi tool đúng, tiếng Việt đủ tốt, ít fail lúc live.

| Tiêu chí demo | OpenAI | Gemini | Chọn |
|---|---|---|---|
| Structured output / `TaskPlan` Zod | Rất chín, schema phức tạp ổn | Có, đôi khi khó với schema lồng/union | **OpenAI** |
| Tool-calling multi-step (agent loop) | Ecosystem + độ tin cậy agent mạnh | Tốt, nhưng edge case nhiều hơn một chút | **OpenAI** |
| Tiếng Việt / đọc văn bản dài (quy định) | Tốt | Thường mạnh, context lớn | Gemini cạnh tranh |
| Chi phí / tốc độ Specialist | Cao hơn (tùy model) | Flash rẻ, nhanh | Gemini nếu tối ưu cost |
| Vercel AI SDK | First-class | Hỗ trợ tốt | Hòa |
| Live demo “đừng gãy plan” | Ưu tiên | Dự phòng failover | **OpenAI primary** |

**Chốt demo:**

```text
Primary:  OpenAI (ví dụ gpt-4o / gpt-4.1-class) — Planner + Credit/Legal/Product
Fallback: Gemini (Flash hoặc Pro) — khi 429/5xx/timeout OpenAI
Embedding: OpenAI embeddings hoặc Gemini embeddings (một nhà, cấu hình env) — không bắt buộc Together
```

```ts
agentModelProfile = {
  planner: { provider: "openai",  model: "gpt-4o" },
  credit:  { provider: "openai",  model: "gpt-4o" },
  legal:   { provider: "openai",  model: "gpt-4o" }, // quy định: ưu tiên model mạnh
  product: { provider: "openai",  model: "gpt-4o-mini" }, // optional: rẻ hơn
  ops:     { provider: "openai",  model: "gpt-4o-mini" },
  // fallbackProvider: "google" / gemini — trong llm gateway (§5.4A)
}
```

**Không chọn Gemini làm primary** cho bản demo này trừ khi: không có/không đủ quota OpenAI, hoặc team đã đo Gemini ổn định hơn trên đúng Zod `TaskPlan` của mình.

**Thuyết trình giám khảo:**  
> Chúng tôi chọn OpenAI cho độ tin cậy agent (plan có schema + tool). Nghiệp vụ ngân hàng không nằm trong trọng số model mà ở RAG/MCP/approval. Gateway đã sẵn sàng failover sang Gemini và sau này sang model nội bộ SHB.

#### Kết luận chốt

```text
Cần:     LLM gateway mỏng (retry + fallback) + trace lỗi
Primary: OpenAI cho Planner/Specialist
Fallback: Gemini khi primary lỗi
Tuỳ chọn: model profile theo agentRole (config)
Không:   user dán API key / BYOK per agent trong bản demo
Tầm nhìn: model/agent do tổ chức kiểm soát; fine-tune / private model sau — không train-from-scratch trong thi
```

---

## 6. Thực thi hành động có kiểm soát (Human-in-the-loop)

Nguyên tắc: *AI không tự quyết định thay người về hành động có tác động thật. Mọi quyết định cuối thuộc về con người.*

Bất kỳ `TaskStep` gọi tool `mutates: true`:

```text
Agent chuẩn bị action → dry-run → preview cho người duyệt
  → Duyệt → step done, tool thực thi trên mock DB
  → Từ chối → step failed, Planner điều chỉnh câu trả lời cuối
```

**Automation:** Agent chỉ đề xuất; user duyệt cấu trúc rồi **tự bật/tắt**. Side-effect nặng trong runtime vẫn có thể qua Approval nếu cần.

**Approval UI:** ✅ **Người thật bấm Duyệt / Từ chối** trên Dashboard cho mọi side-effect (`mutates: true`). Không có auto-approve trong bản demo chính.

---

## 7. Dashboard

Dữ liệu lấy từ `TaskRun`/`TaskStep` (+ `Automation` / `AutomationRun`). Realtime qua WebSocket NestJS.

| Khu vực UI | Nội dung |
|---|---|
| **DAG view** | TaskStep dạng graph; expand worker lồng trong Specialist |
| **Timeline / trace** | Tool call, input/output, RAG citation, thời gian |
| **Approval panel** | Step `waiting_approval`, Duyệt/Từ chối, preview |
| **Automations** | Danh sách, cron, toggle `enabled`, last/next run, lịch sử `AutomationRun` |
| **Final answer** | Câu trả lời tổng hợp + trích dẫn |
| **So sánh single vs multi** | Cùng 1 câu hỏi — thời gian, tool đúng, citation, hành động thật |
| **MCP status** | “Connected: SHB MCP Suite” + connector/capability đã gọi |

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
| Automation trace | `AutomationRun.traceJson` |
| Realtime | WebSocket events |
| Citation | RAG `{ sourceDoc, section, score }` |
| Audit side-effect | Mọi `mutates: true` qua Approval |
| MCP audit | Registry log: bankCode, capability, tool, mutates |
| Structured log | taskRunId, stepId, agentRole, tool, latency |

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
| Human-in-the-loop | Approval trước side-effect; user bật/tắt Automation | Maker-checker, dual control |
| Tool allowlist | Specialist chỉ thấy tool đúng domain qua registry | Policy engine + least privilege |
| Secrets | `.env` / Railway secrets | Vault |
| Prompt injection | System prompt khóa domain; worker không mutate | Sanitization, DLP |
| Network | MCP tách process, Docker network | VPC, mTLS |
| Audit | `TaskStep` + Approval + MCP connector log | Immutable audit log |
| Data | Mock / văn bản công khai | Phân loại dữ liệu, PII policy |

---

## 10. Cấu trúc thư mục & API

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
    │   ├── mcp-client/                 # registry + client
    │   ├── planning/
    │   ├── agents/
    │   ├── approvals/
    │   ├── automations/                # scheduler + AutomationRun
    │   └── realtime/
    ├── data/
    ├── docker-compose.yml
    ├── mcp-servers/                    # SHB MCP Suite (capability servers)
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
| GET | `/api/automations` | Danh sách Automation |
| POST | `/api/automations` | Tạo / lưu Automation sau khi agent đề xuất |
| PATCH | `/api/automations/:id` | Bật/tắt `enabled`, sửa cron |
| POST | `/api/automations/:id/run-now` | Chạy thử ngay |
| GET | `/api/mcp/suite` | Trạng thái SHB MCP Suite / connectors |
| POST | `/api/compare` | Single vs multi |
| WS | `/api/ws/task-runs/:id` | Push realtime TaskRun |
| WS | `/api/ws/automations` | Push `automation.run.updated` |

### Làm việc song song FE ↔ BE

```text
Giai đoạn 1: FE mock theo API.md · BE dựng NestJS + Planner + MCP Suite + RAG
Giai đoạn 2: FE trỏ NEXT_PUBLIC_API_URL → backend thật
```

---

## 11. Việc chưa chốt / còn bỏ dở

| # | Câu hỏi | Trạng thái |
|---|---|---|
| 1 | Mức độ DAG kịch bản demo? | ✅ Đã chốt — **cố định 3** TaskStep: Credit ‖ Legal → Product (§2.4) |
| 2 | Approval: người thật hay auto-approve? | ✅ Đã chốt — **người thật bấm duyệt** (§6) |
| 3 | Multi-user/auth trong demo? | ✅ Đã chốt: **bỏ auth** |
| 4 | Số MCP server dựng thật? | ✅ Đã chốt — **`mcp-los` + `mcp-compliance` thật**; 3 còn lại mock nông (§3) |
| 5 | Nguồn văn bản SBV/SHB công khai cụ thể cho RAG? | 🔜 cần tổng hợp danh sách link trước khi ingest |
| 6 | Specialist nào dùng Mode SPAWN trong demo chính? | ✅ Đã chốt: **Credit Agent** luôn spawn ≤3 worker |
| 7 | LlamaIndex.TS / PGVectorStore adapter ổn định chưa? | 🔜 cần spike ngắn — fallback: retrieval mỏng trên pgvector |
| 8 | UI Dashboard: CSS Modules hay Tailwind cho panel mới? | 💡 mở — chọn theo tốc độ team FE |
| 9 | Payload chi tiết Zod/JSON Schema trong `API.md` | 🔜 chốt trước khi FE dựng mock sâu |
| 10 | Scaffold `frontend/` + `backend/` + Docker Compose | 🔜 chưa có code |
| 11 | Seed khách hàng / sản phẩm / quy định mock | 🔜 chưa làm |
| 12 | Eval harness single vs multi (`POST /api/compare`) | 🔜 sau khi multi-agent ổn |
| 13 | Automation: BullMQ hay cron scan DB? | 💡 mở — ưu tiên BullMQ repeatable nếu Redis đã có trong stack |
| 14 | Runtime Automation có bước LLM (`llm-transform`) không? | 💡 mở — demo cho phép 1 bước tóm tắt; pin model/version |
| 15 | Demo có cần mock connector ngân hàng thứ 2 để chứng minh registry? | 💡 mở — không bắt buộc; có thể stub `BANK_A` mỏng nếu còn thời gian |
| 16 | SHB MCP Suite: gateway process riêng hay chỉ registry trong NestJS? | 💡 mở — demo: registry trong NestJS đủ; gateway riêng = sau demo |
| 17 | Planner tránh điều phối nhầm bằng gì? | ✅ Đã chốt — Agent Catalog + Zod enum + validation + tool allowlist (§2.5) |
| 18 | Agent tự chuyển khi rate-limit / API lỗi? | ✅ Đã chốt — **LLM gateway retry + 1 fallback**; không đổi Specialist vì lỗi model (§5.4) |
| 19 | User nối API key riêng / BYOK per agent? | ✅ Đã chốt — **không làm trong demo**; platform key; BYOK chỉ sau demo nếu SaaS (§5.4) |
| 20 | Model khác nhau theo từng agent? | 💡 mở — cho phép qua env/seed profile; không bắt UI |
| 21 | OpenAI hay Gemini cho demo? | ✅ Đã chốt — **OpenAI primary**, **Gemini fallback** (§5.4E) |

---

## 12. Q&A Giám khảo — lựa chọn công nghệ & kiến trúc

### 12.1 Câu trả lời mở đầu

> Các công nghệ trong đề là **gợi ý**, tiêu chí cốt lõi là năng lực hệ thống: lập kế hoạch, phối hợp đa tác tử, RAG, tool use, MCP, thực thi hành động, human-in-the-loop và quan sát được toàn bộ trace. Nhóm chọn công nghệ tương đương phù hợp với năng lực TypeScript để dành thời gian giải quyết nghiệp vụ ngân hàng. Mỗi lựa chọn được cô lập sau contract chuẩn (MCP, Zod), nên không khóa hệ thống vào một framework.

Ba tiêu chí nhấn mạnh:

1. **Tốc độ giao hàng** trong thời gian thi
2. **Khả năng kiểm soát** — plan có schema, audit, approval, state bền vững
3. **Khả năng thay thế** — MCP, REST/WS, Zod giữ lõi không phụ thuộc framework

### 12.2 “Tại sao không dùng FastAPI mà dùng NestJS?”

> FastAPI phù hợp hệ sinh thái AI Python. Đội ngũ mạnh TypeScript và NestJS đã có sẵn REST, WebSocket, Prisma, logging, Docker. Một ngôn ngữ xuyên suốt frontend, backend, MCP server giảm lỗi contract. Model provider, LlamaIndex và MCP đều có SDK TypeScript. Nếu SHB yêu cầu Python, MCP server và API contract cho phép thay service orchestration mà không đổi frontend.

### 12.3 “Tại sao không dùng LangGraph?”

> LangGraph mạnh cho workflow có state và checkpoint. Với phạm vi demo, nhóm cần DAG nhỏ nhưng lưu từng bước vào PostgreSQL, hiển thị Dashboard và dừng đúng tại phê duyệt — nên triển khai state machine miền nghiệp vụ bằng `TaskRun`/`TaskStep` với Zod. Audit trail và approval là dữ liệu hạng nhất. Nếu workflow phức tạp hơn sau này, LangGraph có thể thay executor phía sau mà không đổi `TaskPlan`, MCP hay UI.

### 12.4 “Tại sao không dùng CrewAI/AutoGen? Không mesh thì có đúng đề bài không?”

> CrewAI/AutoGen phù hợp mesh hội thoại linh hoạt. Trong ngân hàng, mesh agent-to-agent tăng nguy cơ vòng lặp, chi phí token và khó truy nguyên. Nhóm chọn topology hình sao: Planner giao việc; Specialist tạo tối đa ba worker trong một tầng con. Đề bài yêu cầu **năng lực** (planning, tool use, RAG, cộng tác, hành động, MCP, dashboard) — không bắt buộc mesh. Fractal star đáp ứng đủ và khớp hơn với giám sát / đánh giá / bảo mật. “Cộng tác” = nhiều chuyên gia cùng giải yêu cầu liên chức năng dưới planner, không phải mọi agent gọi lẫn nhau.

### 12.5 “Tại sao dùng Vercel AI SDK cho agent loop?”

> Vercel AI SDK cung cấp streaming, structured output, tool calling và nhiều model provider trong TypeScript. Nhóm dùng nó như lớp gọi model mỏng — planning, policy, approval và persistence do domain layer kiểm soát. Đổi OpenAI sang Gemini / Claude / model nội bộ SHB không đổi kiến trúc điều phối.

### 12.6 “Tại sao LlamaIndex.TS thay vì tự viết RAG hoặc LangChain?”

> Giá trị cần chứng minh là RAG chuyên biệt theo nghiệp vụ, có citation và kiểm soát nguồn — không phải tự viết chunking. LlamaIndex chỉ dùng trong `backend/src/rag`; agent loop vẫn Vercel AI SDK. Dự phòng: giữ LlamaIndex cho loading/chunking, query pgvector bằng repository mỏng nếu adapter không ổn.

### 12.7 “Tại sao PostgreSQL + pgvector, không dùng vector DB chuyên dụng?”

> Demo quy mô nhỏ; yêu cầu quan trọng hơn là transaction, audit và liên kết citation với task. PostgreSQL vừa lưu orchestration vừa hỗ trợ vector search — giảm một hệ thống vận hành. Ranh giới `backend/src/rag` cho phép chuyển Qdrant/Pinecone/vector store nội bộ SHB sau này.

### 12.8 “Tại sao MCP server phải tách process? Gọi REST trực tiếp có đơn giản hơn không?”

> REST đơn giản hơn cho demo, nhưng MCP tạo contract chuẩn để agent khám phá và gọi công cụ độc lập framework/model. Tách LOS, Compliance, Core Banking thành MCP server riêng mô phỏng ranh giới hệ thống ngân hàng, cô lập credential/policy, cho phép triển khai on-prem từng connector. NestJS chỉ là MCP client. MCP là **adapter an toàn cho agent** nằm trước REST/gRPC hiện hữu — không thay thế toàn bộ API ngân hàng.

### 12.9 “SHB MCP Suite là gì? Sao không làm một MCP duy nhất?”

> Ở tầng sản phẩm, nhóm đóng gói các connector thành **SHB MCP Suite** — feature kết nối hệ thống vận hành SHB. Ở tầng kỹ thuật vẫn giữ nhiều capability MCP nhỏ dưới registry, vì core banking / LOS / compliance / ops khác quyền hạn, side-effect và owner. Một `shb-mcp` God service làm demo nhanh hơn một chút nhưng làm yếu câu chuyện bảo mật và audit. Cùng registry có thể đăng ký MCP connector của ngân hàng khác theo `bankCode` + capability contract — không hard-code agent vào SHB.

### 12.10 “Automation khác chat TaskRun thế nào?”

> `TaskRun` giải việc phát sinh một lần. `Automation` giải việc lặp lịch (ví dụ báo cáo rủi ro ngày 1 hàng tháng). Agent chỉ **đề xuất** graph; user duyệt rồi **bật/tắt**. Scheduler chạy version đã pin — runtime rẻ, deterministic, có `AutomationRun` để audit. Đây là human-in-the-loop đúng nghĩa vận hành ngân hàng, không chỉ chatbot.

### 12.10b “Trợ lý điều phối dựa vào đâu để không giao nhầm chuyên gia?”

> Planner không đoán cảm tính. Nó đọc **Agent Catalog** (mission, intent, capability, MCP allowlist theo từng role), sinh **TaskPlan** với `agentRole` bị khóa bằng Zod enum, rồi **validation deterministic** trước khi dispatch (capability khớp role, dependsOn hợp lệ, trần số step). Mỗi Specialist chỉ được inject tool đúng domain — dù routing lệch cũng không gọi được MCP ngoài allowlist. Kịch bản demo còn **ghim cố định 3 step** (Credit ‖ Legal → Product) bằng few-shot.

### 12.11 “Tại sao Next.js thay vì React thuần?”

> Next.js vẫn là React, có routing/bundling/deploy sẵn. Dashboard là frontend mỏng — gọi REST và nhận WebSocket từ NestJS; business logic agent không nằm trong Next.js.

### 12.12 “Frontend xây thế nào? Tailwind hay CSS Modules?”

> Frontend là Next.js app độc lập: shell chat + Dashboard (DAG, approval, Automations, so sánh). Không auth/landing. Style chọn theo tốc độ team — miễn nhất quán và chạy được trên desktop/mobile.

### 12.13 “Tại sao tách nhiều service — có over-engineer không?”

> Chỉ tách ở ranh giới có ý nghĩa: frontend, orchestration API, connector MCP trong SHB MCP Suite. Repo không monorepo packages — chỉ `frontend/` + `backend/`. Bên trong API vẫn modular monolith, chưa tách từng agent thành microservice. Nếu thiếu thời gian, chỉ `mcp-los` và `mcp-compliance` đầy đủ; connector khác cùng contract nhưng mock nông.

### 12.14 “Tại sao không dùng monorepo packages chia sẻ type?”

> Mục tiêu cuộc thi là FE và BE làm song song rồi nối API. Shared TypeScript package buộc cùng toolchain/workspace, tăng conflict và setup. Contract HTTP/WS trong `API.md` đủ để FE mock và BE implement độc lập; khi nối chỉ đổi base URL.

### 12.15 “Tại sao không làm authentication?”

> Auth không nằm trong deliverable và không chứng minh năng lực multi-agent. Demo môi trường cô lập, dữ liệu giả lập — nhóm bỏ auth để đầu tư planner, RAG, MCP Suite, approval và trace. Production với SHB: authN/AuthZ, RBAC, service identity, vault và audit theo người dùng là bắt buộc trước khi cho phép side-effect.

### 12.16 “Kiến trúc có khóa vào một nhà model cloud không?”

> Không. Model provider nằm sau `backend/src/llm`; tool sau MCP registry; retrieval sau `backend/src/rag`. Demo dùng OpenAI primary + Gemini fallback; production có thể đặt model gateway nội bộ SHB mà không đổi contract ứng dụng.

### 12.16b “Khi bị rate-limit / API lỗi, agent có tự chuyển không? User có tự gắn API key không?”

> Có **failover mỏng ở tầng LLM gateway**: retry rồi chuyển provider/model dự phòng — không phải Planner đổi chuyên gia (Credit lỗi không giao Legal làm thay). Model profile theo agent là optional qua config. **User BYOK / API key riêng từng agent không làm trong demo**: đề bài không chấm key management, demo không auth, và mô hình ngân hàng thật dùng gateway/vault nội bộ chứ không để nhân viên dán key lên UI. BYOK chỉ hợp lý nếu sau này làm SaaS có đăng nhập.

### 12.16c “Ngân hàng có cho nhân viên dùng agent riêng không? Sau này có train model riêng không?”

> Không theo kiểu cá nhân hóa key/agent ngoài kiểm soát. Chuyên gia số là hệ thống được duyệt: RBAC, approval, audit, MCP connector. Tri thức nghiệp vụ trước mắt đến từ RAG + tool, không cần train foundation model trong hackathon. Lộ trình đúng: (1) gateway + model được duyệt → (2) fine-tune/adapter trên dữ liệu nội bộ đã kiểm → (3) private/on-prem model trong VPC nếu SHB yêu cầu. Train từ zero hiếm khi cần; kiến trúc đã tách `backend/src/llm` để thay model mà không đập multi-agent.

### 12.16d “Demo dùng OpenAI hay Gemini? Cái nào hợp ngân hàng hơn?”

> Không API cloud nào “chuyên SHB”. Nghiệp vụ nằm ở RAG, MCP và approval. Cho demo multi-agent, nhóm chọn **OpenAI làm primary** vì structured output (`TaskPlan`) và tool-calling ổn định hơn khi live; **Gemini làm fallback** khi rate-limit/lỗi. Gemini mạnh context dài / chi phí — hợp làm dự phòng hoặc đọc văn bản dài, không cần làm não Planner chính trừ khi đo thực tế trên schema của nhóm cho kết quả tốt hơn.

### 12.17 “Production-ready chưa?”

> Bản demo chứng minh đúng các **seam kiểm soát** ngân hàng cần: trace end-to-end, approval trước hành động, user bật/tắt automation, tool allowlist, citation, ranh giới MCP. Auth/RBAC/Vault là lớp tích hợp hạ tầng SHB — nhóm cố ý không làm trong hackathon để dồn effort vào multi-agent + action execution, nhưng kiến trúc đã chừa chỗ (không cần đập đi xây lại).

### 12.18 “Có tự tạo agent không?”

> Có — Specialist tự spawn worker (ephemeral agents) cho tác vụ song song, rồi tự tổng hợp. Không tạo vô hạn agent vĩnh viễn. Độ sâu tối đa = 1; ≤3 worker/step; worker không được mutate.

### 12.19 Câu kết khi bị hỏi dồn về stack

> Chúng tôi tối ưu cho **khả năng kiểm soát và khả năng thay thế**, không tối ưu để trình diễn số lượng framework. Phần có giá trị là plan có cấu trúc, collaboration có giới hạn, RAG có citation, action có approval, automation có user bật/tắt, MCP có suite + registry, và trace end-to-end. Stack hiện tại giúp chứng minh các năng lực đó ổn định trong thời gian thi, đồng thời giữ đường thay thế sang Python hoặc hạ tầng nội bộ SHB qua contract chuẩn.
