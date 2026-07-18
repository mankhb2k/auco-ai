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
| 18 | **LLM: MỘT model mặc định (OpenAI) cho mọi agent** — env platform quản; **Gemini fallback** chỉ do gateway kích hoạt khi lỗi; nhân viên **không đổi model**, không BYOK (§5.4) | Đơn giản, audit nhất quán, đúng mô hình ngân hàng: model là hạ tầng được duyệt |
| 19 | **Data scope theo nhân viên (mô phỏng nhẹ, không phải auth thật):** `Employee`/`Customer`/`CustomerPortfolio` + scope-check trước khi gọi MCP, tái dùng Approval khi ngoài danh mục (§2.7) | Đúng nguyên tắc need-to-know của ngân hàng; chi phí thấp vì tái dùng Approval có sẵn |
| 20 | **`bankCode` là seam trên mọi model lõi** (TaskRun, Automation, KnowledgeDocument, Customer, Employee) — demo chỉ seed 1 giá trị `"SHB"`, không xây tenant-switcher UI (§9.5.2) | Sẵn sàng mở rộng nhiều ngân hàng mà không migrate lại schema; đúng tầm nhìn startup multi-bank |
| 21 | **Agent × MCP là catalog ship sẵn (4 chuyên gia cấu hình đầy đủ)** — không có UI cho user cuối tự thêm/xóa tool; admin config = roadmap sau demo (§3.5) | Đúng tinh thần "dùng chuyên gia", không "lắp ráp agent"; giữ nguyên guardrail routing đã chốt ở §2.5 |
| 22 | **RAG nâng cấp "lite":** hybrid vector + Postgres full-text, bảng `DocumentRelation` (amends/supersedes), `effectiveFrom/To` versioning trên `KnowledgeDocument` — **không** xây Graph DB / BM25 engine / Conflict Detector NLP riêng (§4.3) | Giải đúng bài toán "quy định sửa đổi nhiều lần" với chi phí thấp, tránh rủi ro tích hợp hệ thống R&D riêng trong 48h |
| 23 | **Không có Group / multi-session như Aucobot** — "session" = 1 `TaskRun`; chỉ cần 1 Planner (hạ tầng, ẩn) + 4 Specialist cố định, demo chạy 3 (§2.8) | Chọn chuyên gia là việc của Planner có kiểm soát, không phải user tự ráp bot; giữ UX tối giản đúng scope 48h |
| 24 | **Không cho user tự tạo session gọi thẳng 1 agent / chat trực tiếp bỏ qua Planner** — nhu cầu "hỏi nhanh 1 miền" giải bằng **Planner triage** (TaskPlan 1 step khi đơn miền); nhu cầu "chat bỏ qua Planner" giải bằng **lộ baseline single-agent (§8) thành toggle UI** (§2.9) | Giữ Planner là điểm vào duy nhất — đúng trọng tâm deliverable #2/#5; không xây thêm hệ thống session/agent-routing song song |
| 25 | **Go-to-market sau demo: license / on-prem (single-tenant), không SaaS shared** — bank tự triển khai + tự gắn adapter MCP; dữ liệu nằm trong perimeter bank (§1.2, §9.5.4) | Ngân hàng lớn không chấp nhận shared DB đa tenant; kiến trúc registry + `bankCode` khớp bán phần mềm, không khóa SaaS |
| 26 | **Expert ship sẵn = cấu hình (system prompt + catalog + MCP allowlist + RAG domain), không fine-tune / train model riêng** — mọi agent dùng chung 1 model nền (§3.5.1, §5.4D) | Nghiệp vụ nằm ngoài trọng số model; đủ cho demo; chừa chỗ fine-tune/private model sau |
| 27 | **App/Planner tự điều phối từng yêu cầu; IT không vẽ DAG cho từng hồ sơ**. IT quản MCP connector và policy hạ tầng; Trưởng phòng/Knowledge Owner chỉ quản vòng đời tài liệu RAG; Nhân viên thực thi | Giữ Planner là giá trị cốt lõi, đồng thời tách đúng trách nhiệm kỹ thuật, nghiệp vụ và vận hành |
| 28 | **4 Specialist là core platform ship sẵn** (`credit`, `legal`, `product`, `ops`). Phòng ban từng ngân hàng được map vào capability core; không cho Trưởng phòng sửa Agent Catalog/system prompt/tool allowlist trong demo | Các ngân hàng khác nhau chủ yếu ở tri thức, hệ thống tích hợp và policy — không cần viết lại Planner/agent core |

**Đã cân nhắc và loại bỏ:**

- Next.js fullstack + Vercel + Supabase — loại vì giám khảo đánh giá devops
- Auth / multi-tenant **UI** — không thuộc deliverable; nhưng **schema đã chừa seam `bankCode`/`employeeId`** (§9.5)
- Monorepo `packages/*` + Turborepo — tăng độ phức tạp khi FE/BE làm song song
- Mesh agent↔agent tự do — vòng lặp / khó audit; thay bằng fractal star có trần worker
- Một MCP server khổng lồ chứa toàn bộ tool SHB — mất ranh giới hệ thống và audit
- Auto-approve làm mặc định demo — loại; chỉ người thật duyệt side-effect
- **User tự dán API key / BYOK per agent trong demo** — loại: conflict với không auth, rủi ro lộ key trên UI, không chứng minh multi-agent banking; BYOK chỉ hợp lý sau này nếu có auth (SaaS SMB), không phải mô hình bank on-prem đã chốt (§1.2)
- **SaaS shared multi-tenant (một DB chung nhiều ngân hàng)** — loại cho go-to-market ngân hàng lớn; thay bằng license / single-tenant / on-prem + bank tự gắn adapter (§9.5.4)
- **Fine-tune / train model riêng cho từng chuyên gia trong 48h** — loại: nghiệp vụ đến từ prompt + catalog + MCP + RAG; fine-tune chỉ là lộ trình sau khi có data nội bộ đã duyệt (§3.5.1, §5.4D)
- **RBAC engine tổng quát / vault / tenant-switcher UI trong 48h** — loại: chi phí cao, không đổi kết quả demo; chỉ giữ seam schema (§9.5.1)

---

## 1. Đề bài — tóm tắt

**Yêu cầu cốt lõi:** Hệ thống AI đa tác tử, mỗi tác tử = chuyên gia số một mảng nghiệp vụ (Tín dụng, Pháp chế & Tuân thủ, Sản phẩm, Vận hành). Agent phải: tự chủ lập kế hoạch, dùng tool/function calling, RAG chuyên biệt theo agent, cộng tác chéo, **thực thi hành động thật** trên hệ thống vận hành.

**Deliverables bắt buộc:**

1. Demo ≥ 2–3 chuyên gia số cộng tác giải 1 yêu cầu phức tạp
2. Cơ chế **planner agent** chia việc cho **executor agents**
3. Tool-use thật: gọi API / truy vấn dữ liệu / hành động cụ thể
4. **Dashboard** hiển thị trace agent, trạng thái nhiệm vụ, quyết định, luồng cộng tác
5. **So sánh** single-agent chatbot vs hệ thống multi-agent

### 1.1 Phân khúc khách hàng & giá trị (pitch) ✅

Dùng cho slide pitch — ai dùng hệ thống và ai hưởng lợi, khớp với các vai trò đã có trong kiến trúc (Employee/Portfolio §2.7, Approval §6):

| Nhóm | Ai | Khớp với kiến trúc |
|---|---|---|
| **Người dùng trực tiếp** | Nhân viên Tín dụng | `Employee.role = credit_officer` — gửi yêu cầu qua chat, nhận kết quả Credit Agent |
| | Nhân viên Vận hành | `Employee.role = ops_officer` — theo dõi ticket, tạo hồ sơ (Ops Agent) |
| | Bộ phận giám sát quy trình / đánh giá rủi ro / duyệt cuối | **Người duyệt trên Approval panel** (§6) — chính là vai trò `branch_manager`/reviewer đã thiết kế, không phải vai trò mới |
| **Người dùng gián tiếp** | Khách hàng cá nhân / doanh nghiệp SHB | Không đăng nhập hệ thống — là đối tượng được nhân viên tra cứu (`Customer` trong `CustomerPortfolio`, §2.7) |
| | Đối tượng hưởng lợi từ tốc độ duyệt | Ví dụ: DN cần vốn gấp nhập hàng trong ngày — multi-agent chạy song song (Credit ‖ Legal) rút thời gian duyệt từ 2–3 ngày xuống còn vài phút cho case đủ điều kiện rõ ràng |

**Câu pitch dùng được ngay:** *"Hệ thống không chỉ giúp nhân viên trả lời nhanh hơn — nó rút ngắn thời gian một doanh nghiệp cần vốn gấp phải chờ, từ vài ngày xuống vài phút, nhờ 3 chuyên gia số làm việc song song thay vì tuần tự qua nhiều phòng ban."*

### 1.2 Mô hình thương mại sau demo — license / on-prem, không SaaS shared ✅

> **✅ Đã chốt tầm nhìn sản phẩm:** không bán SaaS multi-tenant kiểu “một cloud chung, nhiều ngân hàng chung DB”. Ngân hàng lớn yêu cầu dữ liệu và hệ thống lõi **nằm trong perimeter của họ**. Mô hình đúng: bán **nền tảng phần mềm** (Planner, Specialist, Approval, RAG, Dashboard, MCP registry) — bank **tự triển khai** (single-tenant / VPC / on-prem) và **tự thêm adapter** MCP vào LOS / core / compliance của mình.

| Bên | Trách nhiệm |
|---|---|
| **Đội sản phẩm** | Nền tảng + capability contract chuẩn + support / license theo năm |
| **Ngân hàng** | Deploy trong môi trường của họ + adapter MCP + data + model gateway nội bộ |

Khớp kiến trúc đã chốt: `bankCode` seam (§9.5.2) + Bank Connector Registry (§3.2) — mở rộng bank mới = cấu hình + connector, không viết lại Orchestrator. Chi tiết pitch giám khảo: §9.5.4, §12.16k.

---

## 2. Mô hình multi-agent đã chốt — Planner + Specialist + Worker

Topology: **planner-executor** + Specialist tự spawn worker. Hình sao lồng 1 cấp (fractal star) — không mesh.

> **✅ Chốt UX gốc (áp dụng toàn bộ tài liệu):** User **chỉ chat với đúng 1 điểm vào — Planner/Orchestrator**. Bên trong, 4 Specialist (Credit/Legal/Product/Ops) đã **ship sẵn, cấu hình cố định** (§3.5) — user không thấy, không chọn, không tự thêm agent. Planner tự động điều phối 1 hoặc nhiều Specialist tuỳ độ phức tạp câu hỏi (§2.9), rồi trả **1 câu trả lời tổng hợp duy nhất**. Không có agent picker, không có session-per-agent, không có Group (§2.8).

```text
User ←→ [ 1 Ô CHAT DUY NHẤT — Planner/Orchestrator ]
                        │
          tự động điều phối bên trong (ẩn với user)
                        │
        ┌───────────────┼───────────────┬───────────────┐
     Credit          Legal          Product           Ops
   (ship sẵn)      (ship sẵn)      (ship sẵn)      (ship sẵn)
```

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
  bankCode    String   @default("SHB")     // seam multi-tenant — xem §9.5
  employeeId  String?                      // actor khởi tạo — xem §2.7 (nullable = "demo employee" mặc định)
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

> `bankCode` và `employeeId` là **seam** (chỗ chờ sẵn), không phải auth thật. Demo seed 1 `bankCode = "SHB"` và 1 employee mặc định — nhưng schema đã sẵn sàng cho nhiều ngân hàng / nhiều nhân viên sau này mà không phải migrate lại (§9.5).

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

### 2.7 Nhân viên được dùng data khách hàng nào? — Data scope ✅

**Câu hỏi đúng và còn thiếu trong bản trước:** hệ thống đang giả định 1 phiên duy nhất, "hỏi gì cũng trả lời được", không phân biệt nhân viên A chỉ được xem khách hàng do mình quản lý hay khách toàn ngân hàng. Trong banking thật, đây **không phải chi tiết phụ** — là nguyên tắc *need-to-know* bắt buộc.

**Đánh giá:** deliverable đề bài **không chấm trực tiếp** mục này (không phải multi-agent/RAG/MCP/dashboard). Nhưng chi phí thêm một **bản mô phỏng nhẹ** rất thấp, và nó biến câu chuyện "không auth" từ *lỗ hổng* thành *quyết định có chủ đích, đã lường trước governance*. Khuyến nghị: **làm bản mô phỏng, không làm auth thật.**

#### Model tối thiểu

```prisma
model Employee {
  id          String @id @default(cuid())
  bankCode    String @default("SHB")
  displayName String                    // "Nguyễn Thị B — Chuyên viên Tín dụng"
  role        String                    // credit_officer | compliance_officer | ops_officer | branch_manager
  branchCode  String?
}

model Customer {
  id         String @id @default(cuid())
  bankCode   String @default("SHB")
  fullName   String
  customerNo String
  branchCode String?
}

model CustomerPortfolio {
  id         String @id @default(cuid())
  employeeId String
  customerId String
  bankCode   String @default("SHB")
}
```

#### Luồng — không phải auth, là scope-check trước khi gọi MCP

```text
1. Demo KHÔNG có login — chỉ có 1 banner cố định:
   "Đang dùng với vai trò: Nguyễn Thị B — Chuyên viên Tín dụng — CN Cầu Giấy"
   (hoặc dropdown chọn giữa 2–3 employee mock, KHÔNG cần mật khẩu)
2. TaskRun.employeeId = employee đang chọn (seed sẵn, không phải session thật)
3. Trước khi Specialist gọi MCP tool cần customerId:
     customerId ∈ CustomerPortfolio(employeeId)?
       Có   → gọi tool bình thường
       Không → TaskStep.status = waiting_approval
               reason = "out_of_portfolio_access"
               → hiện trên Approval panel: "Nhân viên X xin truy cập KH ngoài danh mục được giao"
               → branch_manager (mô phỏng) duyệt mới cho tool chạy tiếp
4. Mọi truy cập ngoài danh mục — duyệt hay từ chối — đều ghi vào TaskStep/Approval log
```

→ **Tái dùng nguyên cơ chế Approval đã có (§6)** — không phải xây thêm hệ thống quyền mới. Đây là điểm rất rẻ: 1 check trước dispatch + 1 reason code mới, không thêm bảng phức tạp.

#### Vì sao nên làm (giá rẻ, giá trị cao)

| Lợi ích | Chi tiết |
|---|---|
| Câu chuyện banking thật hơn | Giám khảo hỏi "AI có thấy hết data khách hàng không?" → có câu trả lời bằng demo, không chỉ bằng lời |
| Demo có thêm 1 tình huống "wow" | Ngoài case chính (đủ điều kiện vay), thêm case phụ: hỏi về KH ngoài danh mục → hệ thống tự chặn + xin duyệt |
| Không cần auth thật | Không JWT, không session, không password — chỉ 1 dropdown/banner tĩnh |
| Sẵn seam cho production | `Employee`/`CustomerPortfolio` là mô hình thật ngân hàng cần — không phải mock bỏ đi sau demo |

#### Không làm (ngoài phạm vi 48h)

- Không đăng nhập/mật khẩu/session thật
- Không RBAC engine tổng quát (permission matrix phức tạp)
- Không đồng bộ portfolio thật từ HR/core banking

#### Tóm tắt trả lời giám khảo

> Nhân viên không thấy toàn bộ dữ liệu khách hàng. Mỗi nhân viên mock có **danh mục khách hàng được giao** (`CustomerPortfolio`); agent gọi MCP tool bị chặn nếu `customerId` ngoài danh mục, và phải qua **Approval** giống mọi side-effect khác. Đây là mô phỏng nhẹ, không phải hệ thống auth đầy đủ — nhưng thể hiện đúng nguyên tắc *need-to-know* của ngân hàng, tái dùng cơ chế approval đã có sẵn.

### 2.8 Session / Group — có cần như Aucobot không? ✅

**Trả lời ngắn: không cần Group; "session" chỉ đơn giản là 1 `TaskRun` mới.** Không cần hệ thống session/thread/group như Aucobot.

Aucobot cho user **tự tay thêm nhiều bot vào 1 room** (group), rồi tự tổ chức nhiều cuộc hội thoại song song (sidebar nhiều thread, đổi tên, ghim, lưu trữ) — hợp lý cho một SaaS chat đa mục đích. Hệ thống này **khác về bản chất**: chuyên gia được **Planner tự động chọn có kiểm soát** (§2, §2.5) — người dùng không tự lắp ráp agent vào phòng. Việc "gom nhóm" chính là công việc của Planner, không phải của UI.

| Khái niệm Aucobot | Cần cho demo này? | Thay bằng |
|---|---|---|
| **Group** (tự thêm nhiều bot vào 1 room) | ❌ Không | Planner tự chọn Specialist theo Agent Catalog (§2, §2.5) — cho user tự ráp sẽ phá guardrail chống điều phối nhầm |
| Tạo/đổi tên/ghim/lưu trữ session | ❌ Không | "Gửi yêu cầu mới" = tạo 1 `TaskRun` mới — không có thao tác quản lý thread |
| Sidebar nhiều cuộc hội thoại song song | 💡 Optional | Chỉ cần 1 tab "Lịch sử" liệt kê `TaskRun` cũ (đọc lại trace) — không rename/archive/pin |
| Multi-user, mỗi user nhiều group riêng | ❌ Không | Không auth, 1 phiên cố định (§0 #9) |

**Số agent cần dựng — chốt đúng như bạn tóm:**

```text
1 Planner    — hạ tầng điều phối, KHÔNG hiện diện như "1 bot" trong UI, không cần add vào group
4 Specialist — Credit / Legal / Product / Ops, ship sẵn (§3.5)
   Demo chính chạy 3 (Credit ‖ Legal → Product); Ops optional/off-script (§2.4)
Worker       — không phải "agent cố định" phải quản lý; chỉ sinh tạm trong 1 TaskStep rồi huỷ (§2.3)
```

**UX tối thiểu (không cần copy nguyên khối session/group của Aucobot):**

- 1 ô nhập goal → submit → tạo `TaskRun` → hiện DAG + trace + kết quả (§7)
- Nút *"Yêu cầu mới"* = tạo `TaskRun` mới — không phải "New Chat" kiểu đa thread
- (Optional, P1) 1 tab *Lịch sử* liệt kê `TaskRun` cũ để demo so sánh nhiều lần chạy — chỉ đọc, không sửa/xóa/đổi tên
- Tab *Automations* (§2.6) và *Approvals* (§6) tách riêng, không lồng vào khái niệm session/group

#### Tóm tắt trả lời giám khảo

> Hệ thống không có khái niệm "group" như nền tảng chat-bot thông thường — chọn chuyên gia là việc của Planner có kiểm soát, không phải người dùng tự lắp bot vào phòng. "Session" ở đây tương đương 1 `TaskRun`: gửi yêu cầu mới = tạo TaskRun mới, không cần hệ thống quản lý thread phức tạp. Toàn bộ demo chỉ cần 1 Planner (hạ tầng, ẩn) + 4 chuyên gia cố định, kịch bản chính chạy 3.

### 2.9 "User tạo nhiều session, mỗi session gọi thẳng 1 agent expert" — ❌ Phản biện

Ý này **mâu thuẫn trực tiếp** với §2.8 vừa chốt và **tái tạo đúng mô hình Group** của Aucobot đã đánh giá và loại. Cần nói thẳng 3 vấn đề trước khi đi tiếp:

1. **Xóa mất chính giá trị cốt lõi của đề bài.** Deliverable #2 (Planner chia việc cho executor) và #5 (so sánh single vs multi) giả định: hệ thống **chính** là multi-agent orchestrated. Nếu user tự chọn 1 agent rồi chat thẳng, đó **chính là single-agent chatbot** — thứ cần dùng làm **baseline để so sánh** (§8), không phải trải nghiệm chính. Nếu UX chính trở thành "chọn agent rồi chat", Planner bị chôn thành nút phụ — lệch trọng tâm lúc pitch với giám khảo.
2. **Gấp đôi bề mặt phải build trong 48h.** Cần thêm: session↔agent binding, agent picker UI, context/lịch sử riêng theo mỗi session-agent — cùng lúc vẫn phải giữ luồng Planner-orchestrated cho case multi-agent. Rủi ro lớn cho AI Agent build trong thời gian ngắn, đúng kiểu phức tạp đã loại ở §2.8.
3. **Phá guardrail chống điều phối nhầm.** Toàn bộ §2.5 (Agent Catalog + Zod enum + validation) tồn tại để *hệ thống* luôn chọn đúng chuyên gia. Nếu user tự chọn agent để chat trực tiếp, không gì đảm bảo họ chọn đúng domain — quay lại rủi ro điều phối nhầm, nhưng lần này do người dùng gây ra.

**Nhu cầu thật phía sau ý tưởng — vẫn hợp lý, chỉ cần giải đúng cách.** Nếu mục đích là "câu hỏi đơn giản, đơn miền thì muốn nhanh gọn như hỏi thẳng 1 chuyên gia, không cần cả dàn multi-agent phản hồi rườm rà" — **đúng nhu cầu, không cần session/agent picker để giải:**

```text
User luôn gõ vào CÙNG 1 ô nhập — không chọn agent, không chọn "session cho agent nào"
  → Planner luôn nhận goal, phân tích trước (đã có ở §2.2)
  → Chỉ 1 domain liên quan → TaskPlan CHỈ 1 TaskStep
       → UI hiện gọn như "câu trả lời từ 1 chuyên gia" (1 card, không cần vẽ DAG rườm rà)
  → Nhiều domain liên quan → TaskPlan nhiều TaskStep song song
       → UI hiện DAG + trace đầy đủ (đúng câu chuyện multi-agent)
```

→ Cảm giác **giống** "chat thẳng 1 chuyên gia" khi câu hỏi đơn giản, nhưng **luôn đi qua Planner** — không agent picker, không session-per-agent, không phá guardrail routing. Một luồng duy nhất, độ phức tạp UI co giãn theo độ phức tạp câu hỏi — không phải hai hệ thống song song.

**Nếu vẫn cần tính năng "chat trực tiếp 1 agent, bỏ qua Planner" thật sự:** hệ thống **đã có sẵn** khái niệm này — chính là **baseline single-agent** ở §8 (dùng để so sánh). Đề xuất: lộ `POST /api/compare` (hoặc route tương đương) ra UI thành 1 toggle thật — *"Chế độ: Multi-agent (khuyến nghị) / Single-agent (baseline so sánh)"* — thay vì xây hệ thống session/agent-routing mới. Vừa thoả nhu cầu "nói thẳng với model, không qua planner", vừa đúng khung **so sánh** (đúng deliverable #5), tái dùng 100% thiết kế đã có.

**Chốt lại:**

| Ý tưởng | Quyết định |
|---|---|
| Nhiều session, mỗi session gọi thẳng 1 agent, user tự chat với agent đó | ❌ **Không làm** — mâu thuẫn §2.8, tái tạo Group, phá guardrail routing, gấp đôi bề mặt build |
| Planner triage: câu hỏi đơn miền → TaskPlan 1 step → UI gọn như "1 chuyên gia trả lời" | ✅ **Làm** — cùng 1 luồng đã có, không thêm hệ thống mới |
| Muốn "chat trực tiếp, bỏ qua Planner" đúng nghĩa | ✅ Lộ baseline single-agent (§8) ra UI thành toggle so sánh — không phải feature "session gọi agent" |

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

Thông điệp: **không hard-code agent vào SHB; SHB MCP Suite là connector đầu tiên; cùng kiến trúc gắn MCP ngân hàng khác qua capability registry.** Go-to-market sau demo: bán nền tảng + bank tự gắn adapter — không SaaS shared (§1.2, §9.5.4).

### 3.5 Agent nào được gọi API/tool nào? — Ma trận quyền + UX "ship sẵn expert" ✅

**Câu hỏi đúng, và câu trả lời ngắn: đã có (Agent Catalog §2.5), nhưng chưa từng gộp thành 1 bảng nhìn xuyên suốt + chưa trả lời rõ UX.** Chốt tại đây.

#### Ma trận quyền — nguồn sự thật duy nhất (đồng bộ với `allowedMcp` ở §2.5)

| Agent | MCP server | Tool được gọi | Side-effect (`mutates`) |
|---|---|---|---|
| **Credit Agent** | `mcp-core-banking` | `get_account_balance`, `get_transaction_history`, `get_credit_score` | Không |
| | `mcp-los` | `check_loan_eligibility` | Không |
| | | `submit_loan_application` | ⚠️ Có → Approval |
| | RAG | `credit_kb_search` | Không |
| **Legal/Compliance Agent** | `mcp-compliance` | `run_aml_check`, `search_regulation` | Không |
| | | `flag_transaction` | ⚠️ Có → Approval |
| | RAG | `legal_kb_search` | Không |
| **Product Agent** | `mcp-product` | `list_products`, `check_product_eligibility`, `compare_products` | Không |
| | RAG | `product_kb_search` | Không |
| **Operations Agent** | `mcp-ops` | `get_ticket_status`, `assign_department` | Không |
| | | `create_service_ticket` | ⚠️ Có → Approval |
| | `mcp-los` (đọc) | tra cứu trạng thái hồ sơ | Không |

Đây **chính là** `AgentCapability.allowedMcp` ở §2.5 hiển thị dạng bảng đầy đủ — không phải cấu hình thứ hai; Orchestrator đọc **1 nguồn** (`agent-catalog.ts` seed trong `backend/`), bảng trên chỉ là view để thuyết trình/audit.

#### UX: user tự cấu hình hay ship sẵn expert? → **Ship sẵn, không cấu hình trong demo** ✅

| Phương án | Đánh giá |
|---|---|
| **A. Ship sẵn 4 chuyên gia cố định** (catalog + allowlist hard-code) | ✅ **Chốt cho 48h** — nhất quán với Zod enum khóa `agentRole` (§2.5), an toàn, nhanh build |
| **B. Admin tự thêm/xóa tool cho từng agent qua UI** | 💡 Roadmap sau demo — cần policy engine + validate tool schema mỗi lần đổi, không rẻ |
| **C. User cuối (nhân viên) tự chọn tool khi chat** | ❌ **Không làm** — sai mô hình; nhân viên dùng chuyên gia đã cấu hình sẵn, không lắp ráp agent |

**Lý do chốt Ship sẵn (A):**

- Đúng tinh thần "chuyên gia số" của đề bài — nhân viên **dùng** chuyên gia đã được duyệt, không **cấu hình** chuyên gia
- Khớp với §2.5 (Zod enum) và §9.5 (không làm RBAC/policy engine trong 48h) — thêm UI cấu hình sẽ phá vỡ chính guardrail chống điều phối nhầm đã dựng
- Ngân hàng thật cũng không muốn nhân viên tự gắn API tùy ý vào một "AI agent" — đúng mạch lý luận ở §5.4D (model/agent do tổ chức kiểm soát)

**Roadmap (không làm trong 48h):** "Agent Studio" cho admin/quản trị SHB — thêm agent mới, gán tool mới, đổi allowlist — nhưng vẫn qua review/publish, không phải end-user tự bật tool sống ngay.

#### 3.5.1 Chuyên gia “biết việc” thế nào? — Không train, cấu hình 4 lớp ✅

**Không** fine-tune / train model riêng cho Credit/Legal/Product/Ops trong demo. Cả 4 dùng **cùng một model nền** (OpenAI; Gemini chỉ fallback gateway — §5.4). Khác biệt chuyên môn nằm ở cấu hình:

| Lớp | Nội dung | Nơi sống |
|---|---|---|
| **1. System prompt theo role** | Mission, phạm vi, không làm gì, format trả lời | `backend/src/agents/<role>/system.ts` (hoặc tương đương) |
| **2. Agent Catalog** | Intent, capability, `allowedMcp`, output schema Zod | `agent-catalog.ts` seed — §2.5 |
| **3. Tool allowlist (MCP)** | Chỉ inject tool đúng domain lúc runtime | Orchestrator đọc catalog — §3.5 ma trận |
| **4. RAG theo domain** | Tri thức SBV/SHB/sản phẩm + citation | `credit_kb_search` / `legal_kb_search` / … — §4 |

```text
Sai:  "Huấn luyện" = fine-tune 4 model riêng cho 4 chuyên gia
Đúng: "Ship sẵn" = 1 model nền + 4 bộ (prompt + catalog + tools + RAG)
```

**Lộ trình sau demo** (đã có ở §5.4D, không đổi): (1) RAG + prompt + tool → (2) fine-tune/adapter nếu bank có data đã duyệt → (3) private/on-prem model qua gateway. Train từ zero không cần.

#### Tóm tắt trả lời giám khảo

> Mỗi chuyên gia có allowlist tool cố định, khai báo trong Agent Catalog và ép bằng validation (§2.5) — không phải cấu hình rời. Về UX, chúng tôi **ship sẵn 4 chuyên gia đã cấu hình đầy đủ**, nhân viên dùng ngay không cần setup. “Chuyên gia” không phải model đã train sẵn: cùng một model nền, khác nhau ở **system prompt + catalog + MCP + RAG**. Cho phép admin ngân hàng tùy biến catalog qua một "Agent Studio" là hướng mở rộng hợp lý sau demo, nhưng không phải việc của người dùng cuối, và không cần trong 48h vì có thể phá vỡ guardrail routing đã chốt.

#### 3.5.2 Ranh giới quản trị khi triển khai cho ngân hàng khác ✅

Platform giữ **Planner + 4 Specialist + Agent Catalog + schema + tool allowlist** làm core ship sẵn. Từng ngân hàng không phải tự xây lại agent; họ cung cấp hai phần khác biệt: **connector MCP** tới hệ thống nội bộ và **tài liệu RAG** đã được duyệt.

| Vai | Được quyết định | Không quyết định |
|---|---|---|
| **App / Planner** | Chọn Specialist và sinh DAG cho từng yêu cầu trong catalog + validation đã khóa | Không tự tạo role/tool ngoài catalog |
| **IT / Platform bank** | MCP nối LOS/core/compliance nào, trạng thái connector, model gateway và policy hạ tầng | Không ngồi chọn Credit/Legal cho từng câu chat; không sửa tài liệu nghiệp vụ |
| **Trưởng phòng / Knowledge Owner** | Tạo draft, version, publish/supersede tài liệu RAG theo domain | Không sửa Agent Catalog, system prompt, Zod schema hoặc MCP allowlist trong demo |
| **Nhân viên** | Gửi yêu cầu và thực thi trên phạm vi dữ liệu được giao | Không cấu hình agent, tool hoặc publish KnowledgeDocument |

```text
IT gắn đường ống (MCP)
Trưởng phòng xuất bản tri thức (RAG)
Nhân viên gửi mục tiêu
App/Planner tự điều phối Specialist
```

#### Slide pitch — 3 lớp quyền (demo)

```text
┌─────────────────────────────────────────────────────────────┐
│  L1 — IT / Platform                                         │
│  MCP connector enable/disable · suite status · audit read   │
├─────────────────────────────────────────────────────────────┤
│  L2 — Manager / Knowledge owner                             │
│  Knowledge draft→publish · Approval HITL · audit read       │
├─────────────────────────────────────────────────────────────┤
│  L3 — Employee / Operator                                   │
│  Chat TaskRun · Compare · portfolio scope                   │
└─────────────────────────────────────────────────────────────┘
         ▲                        ▲
         │ X-Demo-Employee-Id     │ AuditEvent
         │ (không login)          │ actorId · action · resource · at
```

Demo UI: **một Dashboard + role switcher** — nav ẩn theo `accessLayer`; không JWT/SSO. Chi tiết triển khai: `role.md`.

“Chuẩn hóa agent” trong UI quản lý tài liệu phải được hiểu là **chuẩn hóa tri thức mà agent truy xuất**, không phải train model hay thay đổi logic điều phối. RAG chỉ ảnh hưởng câu trả lời của Specialist sau khi Planner đã chọn domain; nó không thay Agent Catalog và không được dùng để invent role mới.

Phòng ban ở từng ngân hàng có thể có tên hoặc cách chia khác nhau (ví dụ Retail Credit / Corporate Credit, Legal gộp Compliance), nhưng được **map vào capability core** trước. Chỉ khi xuất hiện một capability thực sự mới mới cân nhắc Agent Studio — roadmap có review/publish + policy validation, không phải cấu hình sống của Trưởng phòng trong demo.

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
  id            String    @id @default(cuid())
  domain        String                      // credit | legal | product | ops
  bankCode      String    @default("SHB")   // seam multi-tenant (§9.5.2)
  title         String
  sourceUrl     String?
  content       String    @db.Text
  status        String    @default("active") // active | superseded — xem §4.3
  effectiveFrom DateTime?
  effectiveTo   DateTime?                    // null = còn hiệu lực
  // vector do LlamaIndex PGVectorStore quản lý (không khai báo qua Prisma)
}
```

### 4.3 Văn bản sửa đổi nhiều lần — bản "lite" của Vector+BM25+Graph+Versioning ✅

Có tham khảo một đề xuất "bộ não hệ thống" đầy đủ: **Vector + BM25 + Graph Traversal + Versioning Engine + Conflict Detector** để xử lý bài toán rất thật của banking — *một quy định bị sửa nhiều lần, điều khoản bị thay thế một phần*. Đây là bài toán đúng và nên đưa vào pitch. Nhưng **implement đầy đủ 5 thành phần đó trong 48h là quá rộng** — mỗi thành phần (graph DB, BM25 engine riêng, conflict-detection model) là một hạng mục R&D độc lập, rủi ro tích hợp cao cho AI Agent build trong thời gian ngắn.

**Right-size lại thành 3 việc rẻ, nằm gọn trong `backend/src/rag/` đã có — không thêm hệ thống mới:**

| Ý trong đề xuất | Bản lite áp dụng | Chi phí |
|---|---|---|
| **Vector search** | Đã có — pgvector (§4) | Có sẵn |
| **BM25 keyword search** | **Postgres full-text search** (`tsvector`/`ts_rank`) kết hợp điểm với vector — hybrid search 2 nguồn, không cần Elastic/BM25 engine riêng | Thấp — 1 cột `tsvector` + 1 query |
| **Graph Traversal** (văn bản A sửa văn bản B) | **1 bảng quan hệ** `DocumentRelation` (không phải graph DB) — truy vấn bằng JOIN/CTE thường, không phải Cypher | Thấp — 1 bảng + vài query |
| **Versioning Engine** | `effectiveFrom`/`effectiveTo`/`status` trên `KnowledgeDocument` (đã thêm ở model trên) — retrieval lọc mặc định `status = active` | Rất thấp — chỉ field + filter |
| **Conflict Detector** (NLP so khớp mâu thuẫn) | **Không xây model riêng** — khi retrieval trả nhiều chunk cùng chủ đề, đưa cả `status`/ngày hiệu lực vào prompt, để LLM tự chọn bản mới nhất và **luôn ghi rõ trong citation** "đã bị thay thế bởi [X] ngày [d]" nếu có | Thấp — prompt engineering, không code riêng |

```prisma
model DocumentRelation {
  id           String @id @default(cuid())
  fromDocId    String                 // văn bản mới / sửa đổi
  toDocId      String                 // văn bản bị tác động
  relationType String                 // amends | supersedes | replaces_clause
  note         String? @db.Text       // ví dụ: "Điều 5 thay thế Điều 3 văn bản cũ"
}
```

```text
retrieve(domain, query):
  1. hybridScore = weightedSum(vectorScore, ts_rank(query))   // hybrid, không cần service riêng
  2. lọc mặc định: KnowledgeDocument.status = "active"
     (nếu user hỏi lịch sử/so sánh phiên bản → cho phép trả cả "superseded", đánh dấu rõ)
  3. join DocumentRelation → nếu doc có bản đã thay thế / bị thay thế, gắn ghi chú vào citation
  4. trả context + citation kèm trạng thái hiệu lực cho LLM tổng hợp
```

**Không làm trong 48h:** Neo4j/graph database riêng, BM25 engine độc lập (Elasticsearch/OpenSearch), model NLP chuyên phát hiện mâu thuẫn pháp lý. Chi phí tích hợp cao, rủi ro lớn hơn giá trị tăng thêm cho demo.

**Câu pitch dùng được:** *"Hệ thống hiểu văn bản pháp lý bị sửa đổi nhiều lần — không trích dẫn điều khoản đã hết hiệu lực — bằng cách kết hợp tìm kiếm ngữ nghĩa, từ khóa và quan hệ giữa các văn bản, không cần một hệ thống Graph AI riêng biệt."*

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

### 5.4 LLM gateway — model mặc định, limit, lỗi API ✅

Ba ý thường bị lẫn — tách rõ:

| Ý tưởng | Demo thi | Đánh giá |
|---|---|---|
| **A. Auto failover khi rate-limit / API lỗi** | ✅ Làm **mỏng** trong `backend/src/llm` | Cần thiết cho live demo ổn định |
| **B. Model/profile khác nhau theo agent hoặc user tự đổi model** | ❌ **Không làm** — 1 model mặc định do platform quản | Đơn giản, dễ audit; nhân viên không được đổi model |
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

#### B. Một model mặc định — không per-agent, không user đổi ✅

```text
DEFAULT_LLM = { provider: "openai", model: "gpt-4o" }   ← env, platform quản lý
FALLBACK_LLM = { provider: "google", model: "gemini-*" } ← chỉ gateway dùng khi lỗi

Planner + Credit + Legal + Product + Ops → cùng DEFAULT_LLM
Nhân viên / UI: KHÔNG có settings chọn model, không dán key
Đổi model = đổi env + deploy (quyết định của platform, có kiểm soát)
```

Lý do chốt như vậy:

- **Đơn giản hóa demo** — một cấu hình, một hành vi, dễ debug plan lệch
- **Audit nhất quán** — mọi trace cùng model/version; so sánh single vs multi không nhiễu biến model
- **Đúng mô hình ngân hàng** — model là hạ tầng được duyệt, nhân viên dùng chứ không cấu hình
- Fallback (§5.4A) là cơ chế **hệ thống**, không phải lựa chọn của user

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
| **1. RAG + prompt + tool** (đang làm) | “Hiểu” nghiệp vụ SHB qua tài liệu + MCP, không cần train — chi tiết 4 lớp ở §3.5.1 | **Demo / giai 1** |
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
Model mặc định: OpenAI (ví dụ gpt-4o / gpt-4.1-class) — TẤT CẢ agent dùng chung
Fallback:       Gemini (Flash hoặc Pro) — chỉ gateway kích hoạt khi 429/5xx/timeout
Embedding:      OpenAI embeddings hoặc Gemini embeddings (một nhà, cấu hình env)
User/nhân viên: không chọn model, không dán key
```

**Không chọn Gemini làm primary** cho bản demo này trừ khi: không có/không đủ quota OpenAI, hoặc team đã đo Gemini ổn định hơn trên đúng Zod `TaskPlan` của mình.

**Thuyết trình giám khảo:**  
> Chúng tôi chọn OpenAI cho độ tin cậy agent (plan có schema + tool). Nghiệp vụ ngân hàng không nằm trong trọng số model mà ở RAG/MCP/approval. Gateway đã sẵn sàng failover sang Gemini và sau này sang model nội bộ SHB.

#### Kết luận chốt

```text
Cần:     LLM gateway mỏng (retry + fallback) + trace lỗi
Model:   MỘT model mặc định (OpenAI) cho mọi agent — env platform quản
Fallback: Gemini khi primary lỗi — cơ chế hệ thống, không phải lựa chọn user
Không:   per-agent model, user đổi model, user dán API key / BYOK
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

**UX:** đây **không phải** endpoint chỉ dùng nội bộ để eval — lộ thành **1 toggle thật trên UI**: *"Chế độ: Multi-agent (khuyến nghị) / Single-agent (baseline)"*. Đây cũng là câu trả lời đúng cho nhu cầu "muốn chat thẳng, bỏ qua Planner" (§2.9) — không cần xây thêm hệ thống session/agent-picker riêng, tái dùng đúng 1 tính năng đã có sẵn trong deliverable #5.

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

## 9.5 Đánh giá kiến trúc (Senior Review) — khoảng trống, multi-bank, phạm vi 48h

Nhìn lại toàn bộ thiết kế ở góc senior: phần **điều phối** (Planner/Specialist/Worker, routing an toàn, approval, automation, LLM gateway) đã chặt. Khoảng trống thật nằm ở hai chỗ: **data scope theo nhân viên** (đã giải ở §2.7) và **seam multi-tenant** để không phải viết lại khi mở rộng nhiều ngân hàng.

### 9.5.1 Bảng khoảng trống — mức độ cần thiết

| Khoảng trống | Có bắt buộc cho track thi? | Chi phí thêm | Khuyến nghị |
|---|---|---|---|
| **Data scope theo nhân viên** (§2.7) | Không trực tiếp | Thấp — tái dùng Approval | ✅ **Làm** — rẻ, tăng credibility banking rõ rệt |
| **`bankCode` trên model lõi** (TaskRun, Automation, KnowledgeDocument, Customer, Employee) | Không | Rất thấp — chỉ thêm field + default | ✅ **Làm ngay** — tránh migrate lại khi lên nhiều ngân hàng |
| **`Customer`/`Employee` seed tối thiểu** | Không | Thấp | ✅ **Làm** — cần để §2.7 có dữ liệu chạy demo |
| **Actor/audit trên TaskStep/AutomationRun** (ai bấm, ai duyệt) | Gián tiếp (đề bài có nhắc "quyết định") | Rất thấp | ✅ **Làm** — 1 field, giá trị audit lớn |
| Agent Catalog data-driven theo từng bank (không chỉ enum cứng SHB) | Không | Trung bình | 💡 **Ghi nhận, không làm** — enum cứng vẫn an toàn hơn cho 48h; catalog theo tenant để sau |
| PII masking trên Dashboard (che số tài khoản khi ngoài scope) | Không | Thấp–trung bình | 💡 Làm nếu còn dư thời gian, không phải P0 |
| Idempotency scheduler (tránh chạy Automation trùng) | Không | Thấp | 💡 Làm nếu còn dư thời gian |
| RBAC engine tổng quát / policy language | Không | Cao | ❌ **Không làm** — quá rộng cho 48h, không đổi kết quả demo |
| Auth thật (login, JWT, session) | Không (đã chốt bỏ) | Cao | ❌ **Không làm** — giữ quyết định §0 #9 |
| Vault / mã hóa secret nâng cao | Không | Cao | ❌ **Không làm** — `.env` đủ cho demo |
| Đa tenant UI (chọn ngân hàng trên FE) | Không | Trung bình | ❌ **Không làm UI** — chỉ cần schema có seam |
| Fine-tune / train model riêng | Không | Rất cao | ❌ **Không làm** — đã chốt ở §5.4D, chỉ là tầm nhìn |

### 9.5.2 Multi-tenant seam — mở rộng nhiều ngân hàng, không riêng SHB

MCP registry đã có `bankCode` (§3.2). Để câu chuyện startup "nhiều ngân hàng" nhất quán từ MCP xuống tận data, cần rải `bankCode` vào các model lõi **ngay từ đầu** — chi phí gần như 0 lúc này, chi phí migrate lại sau demo là lớn:

```text
TaskRun.bankCode            (đã thêm §2.1)
Automation.bankCode         (thêm tương tự — seed "SHB")
KnowledgeDocument.bankCode  (RAG namespace theo domain + bank, không chỉ domain)
Customer.bankCode / Employee.bankCode  (§2.7)
MCP Connector Registry.bankCode        (đã có §3.2)
```

**Nguyên tắc:** demo chỉ seed **1 giá trị `bankCode = "SHB"`** — không xây UI chuyển ngân hàng, không xây tenant switcher. Nhưng vì field đã có sẵn ở mọi bảng, thêm ngân hàng thứ 2 sau demo = **seed data mới + connector mới**, không phải viết lại schema hay orchestrator.

**Điểm cần nói rõ khi giám khảo hỏi "có phải chỉ làm cho SHB không":**

> Chúng tôi không hard-code SHB vào logic. `bankCode` là seam trên mọi bảng lõi và trên MCP registry. Bản demo chỉ seed một ngân hàng vì đó là phạm vi đề bài, nhưng thêm ngân hàng thứ hai là thao tác cấu hình/seed, không phải refactor kiến trúc.

### 9.5.3 Phạm vi "vừa đủ" cho 48h — thứ tự ưu tiên

Với ràng buộc 48h và team dùng AI Agent để build, ưu tiên theo P0 (bắt buộc, đúng deliverable) → P1 (rẻ, tăng điểm senior) → P2 (bỏ nếu thiếu giờ) → Không làm:

| Ưu tiên | Việc |
|---|---|
| **P0 — đúng deliverable** | Planner/Specialist/Worker (§2), MCP `los`+`compliance` thật (§3), RAG citation (§4), Approval thật (§6), Dashboard DAG+trace+compare (§7,§8) |
| **P1 — rẻ, tăng chất lượng senior** | `bankCode` seam (§9.5.2), Employee/Customer/Portfolio + scope-check tái dùng Approval (§2.7), 1 Automation mẫu + toggle (§2.6), LLM gateway retry+fallback (§5.4A) |
| **P2 — làm nếu còn dư giờ** | PII masking nhẹ trên Dashboard, idempotency scheduler, mock connector ngân hàng thứ 2 chỉ để demo registry hoạt động (không cần đầy đủ) |
| **Không làm trong 48h** | Auth thật, RBAC engine, vault, tenant-switcher UI, fine-tune, catalog data-driven đa tenant |

**Lằn ranh "vừa đủ, tránh over-engineer":** mọi seam ở P1 chỉ là **field + 1 check logic**, không kéo theo UI phức tạp hay migration lớn. Nếu một ý tưởng cần thêm bảng mới + UI mới + luồng duyệt mới → mặc định đẩy xuống P2/không làm, trừ khi nó tái dùng cơ chế đã có (như §2.7 tái dùng Approval).

### 9.5.4 Go-to-market — bán phần mềm + bank tự gắn adapter, không SaaS shared ✅

Kiến trúc multi-bank (`bankCode` + MCP registry) **không** đồng nghĩa với SaaS shared tenancy. Với ngân hàng Việt Nam (và hầu hết ngân hàng có giám sát chặt):

| Mô hình | Ngân hàng lớn chấp nhận? | Ghi chú |
|---|---|---|
| SaaS shared (1 cloud, nhiều bank chung DB) | Rất khó | Lo ngại cư trú dữ liệu, audit, rò rỉ chéo tenant |
| Single-tenant / VPC riêng mỗi bank | Có thể | Vẫn “subscription vận hành”, dữ liệu tách |
| On-prem / private cloud của bank | Ưa thích khi đụng KH / tín dụng / side-effect | Phổ biến với hệ thống lõi |
| Hybrid | Thực tế nhất | Platform trong perimeter bank; LLM qua gateway nội bộ; MCP gọi core của bank |

**Chốt mô hình bán hàng sau demo:**

```text
Bán nền tảng (license / subscription theo năm)
  ├─ Planner / Orchestrator, Specialist, Approval, RAG, Dashboard
  ├─ MCP Connector Registry + capability contract
  └─ Bank tự triển khai + tự viết / gắn adapter MCP
       (LOS, core-banking, compliance, product, ops của họ)
```

- **Không** giả định “đổi URL là nối mọi ngân hàng” (§3.2) — mỗi bank vẫn cần adapter riêng.
- **Không** pitch production như multi-tenant SaaS chung DB; pitch đúng: *platform isolated per bank, bank sở hữu data và connector*.
- Có thể thu phí như SaaS (license năm + support), nhưng **triển khai và dữ liệu** theo hướng software / single-tenant / on-prem — khớp kỳ vọng ngân hàng.

**Câu trả lời giám khảo:**

> Chúng tôi không bán SaaS kiểu nhiều ngân hàng dùng chung một database. Ngân hàng cần dữ liệu chỉ nằm trong môi trường của họ. Sản phẩm là nền tảng multi-agent + registry MCP; mỗi ngân hàng triển khai riêng và tự gắn adapter vào hệ thống vận hành của mình. SHB MCP Suite là connector đầu tiên chứng minh contract đó.

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
| 20 | Model khác nhau theo từng agent / user tự đổi model? | ✅ Đã chốt — **không**; một model mặc định, platform quản qua env (§5.4B) |
| 21 | OpenAI hay Gemini cho demo? | ✅ Đã chốt — **OpenAI primary**, **Gemini fallback** (§5.4E) |
| 22 | Nhân viên dùng data khách hàng nào — có cần trong track thi không? | ✅ Đã chốt — không bắt buộc nhưng **nên làm bản mô phỏng nhẹ**: Employee/Customer/Portfolio + scope-check tái dùng Approval (§2.7) |
| 23 | Kiến trúc có sẵn sàng nhiều ngân hàng, không chỉ SHB? | ✅ Đã chốt — `bankCode` seam trên mọi model lõi; demo seed 1 giá trị, không xây UI đa tenant (§9.5.2) |
| 24 | Có cần RBAC engine / auth thật để hỗ trợ data scope không? | ✅ Đã chốt — **không** trong 48h; scope-check + Approval là đủ cho demo (§9.5.1) |
| 25 | Agent có quyền gọi API/tool nào — user tự cấu hình hay ship sẵn? | ✅ Đã chốt — **ship sẵn 4 chuyên gia cấu hình đầy đủ**; không có UI cấu hình cho end-user; admin config là roadmap (§3.5) |
| 26 | Có xây Graph DB / BM25 engine / Conflict Detector riêng cho văn bản sửa đổi không? | ✅ Đã chốt — **không**; dùng bản lite: Postgres full-text + `DocumentRelation` + versioning field + prompt engineering (§4.3) |
| 27 | Có cần Group / multi-session như Aucobot không? | ✅ Đã chốt — **không**; "session" = 1 `TaskRun`; chỉ 1 Planner (ẩn) + 4 Specialist cố định, demo chạy 3 (§2.8) |
| 28 | User tự tạo session gọi thẳng 1 agent, chat trực tiếp bỏ qua Planner? | ✅ Đã chốt — **không**; giải bằng Planner triage (1-step fast path) + lộ baseline single-agent (§8) thành toggle UI (§2.9) |
| 29 | Sau demo bán SaaS shared hay phần mềm cho bank? | ✅ Đã chốt — **license / on-prem (single-tenant)**; bank tự triển khai + tự gắn adapter MCP; không SaaS shared DB (§1.2, §9.5.4) |
| 30 | Expert ship sẵn huấn luyện thế nào — fine-tune hay prompt? | ✅ Đã chốt — **không fine-tune**; 4 lớp: system prompt + Agent Catalog + MCP allowlist + RAG domain; chung 1 model nền (§3.5.1) |

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

> Có **failover mỏng ở tầng LLM gateway**: retry rồi chuyển provider/model dự phòng — không phải Planner đổi chuyên gia (Credit lỗi không giao Legal làm thay), và cũng không phải user chọn. **Nhân viên không đổi model, không dán API key**: hệ thống dùng một model mặc định do platform quản qua env; đề bài không chấm key management, demo không auth, và ngân hàng thật dùng gateway/vault nội bộ. BYOK chỉ hợp lý nếu sau này làm SaaS có đăng nhập.

### 12.16c “Ngân hàng có cho nhân viên dùng agent riêng không? Sau này có train model riêng không?”

> Không theo kiểu cá nhân hóa key/agent ngoài kiểm soát. Chuyên gia số là hệ thống được duyệt: RBAC, approval, audit, MCP connector. Tri thức nghiệp vụ trước mắt đến từ RAG + tool, không cần train foundation model trong hackathon. Lộ trình đúng: (1) gateway + model được duyệt → (2) fine-tune/adapter trên dữ liệu nội bộ đã kiểm → (3) private/on-prem model trong VPC nếu SHB yêu cầu. Train từ zero hiếm khi cần; kiến trúc đã tách `backend/src/llm` để thay model mà không đập multi-agent.

### 12.16d “Demo dùng OpenAI hay Gemini? Cái nào hợp ngân hàng hơn?”

> Không API cloud nào “chuyên SHB”. Nghiệp vụ nằm ở RAG, MCP và approval. Nhóm chốt **một model mặc định: OpenAI** cho mọi agent vì structured output (`TaskPlan`) và tool-calling ổn định khi live; **Gemini là fallback hệ thống** khi rate-limit/lỗi — không phải lựa chọn của nhân viên. Đổi model là quyết định platform (env + deploy), giữ audit nhất quán như cách ngân hàng quản hạ tầng được duyệt.

### 12.16e “Nhân viên được dùng dữ liệu khách hàng nào? Có phân quyền theo khách hàng không?”

> Có, nhưng ở mức mô phỏng chứ không phải hệ thống RBAC đầy đủ. Mỗi nhân viên mock có **danh mục khách hàng được giao** (`CustomerPortfolio`). Trước khi agent gọi MCP tool cần `customerId`, hệ thống kiểm tra khách hàng đó có thuộc danh mục nhân viên đang dùng không; nếu không, step chuyển `waiting_approval` với lý do "truy cập ngoài danh mục" và tái dùng đúng luồng approval đã có — không xây thêm hệ thống quyền riêng. Đây là seam đúng hướng ngân hàng thật (need-to-know), triển khai với chi phí thấp trong 48h.

### 12.16f “Kiến trúc này chỉ làm cho SHB hay mở rộng được nhiều ngân hàng?”

> Không hard-code SHB. `bankCode` là field seam trên mọi model lõi (TaskRun, Automation, KnowledgeDocument, Customer, Employee) và trên MCP Connector Registry (§3.2). Bản demo chỉ seed một giá trị `bankCode = "SHB"` vì đó là phạm vi đề bài — không xây tenant-switcher UI, không multi-tenant billing. Nhưng vì seam đã có sẵn ở data layer, mở rộng ngân hàng thứ hai là thêm seed + connector mock, không phải viết lại orchestrator hay Planner.

### 12.16k “Sau này bán SaaS cho nhiều ngân hàng được không? Họ có chấp nhận dữ liệu ra ngoài không?”

> Khả thi về sản phẩm, nhưng **không** theo hướng SaaS shared (một cloud / một DB cho nhiều bank). Ngân hàng lớn thường chỉ chấp nhận dữ liệu và hệ thống lõi nằm trong perimeter của họ (single-tenant, VPC, hoặc on-prem). Mô hình đúng: bán **nền tảng phần mềm** — bank tự triển khai, tự gắn adapter MCP vào LOS/core/compliance; đội sản phẩm cung cấp capability contract + license/support. Kiến trúc hiện tại (`bankCode` + registry) đã khớp lộ trình đó; SHB MCP Suite chỉ là connector đầu tiên (§1.2, §9.5.4).

### 12.16g “Agent có quyền gọi API/tool nào? Nhân viên có tự cấu hình được không?”

> Mỗi chuyên gia có allowlist tool cố định trong Agent Catalog (§2.5, §3.5) — ví dụ Credit Agent chỉ gọi `mcp-core-banking` + `mcp-los`, Legal chỉ gọi `mcp-compliance`. Chúng tôi **ship sẵn 4 chuyên gia đã cấu hình đầy đủ**; nhân viên dùng ngay, không tự thêm/xóa tool. Cho phép admin ngân hàng tùy biến catalog qua một "Agent Studio" là hướng mở rộng hợp lý, nhưng không cần trong bản demo — thêm UI cấu hình lúc này có thể phá vỡ chính cơ chế chống điều phối nhầm đã dựng.

### 12.16l “Chuyên gia ship sẵn được huấn luyện thế nào — train model hay chỉ system prompt?”

> Không train / fine-tune model riêng cho từng chuyên gia trong demo. Cả bốn dùng **cùng một model nền**. “Biết việc” nhờ bốn lớp cấu hình: (1) **system prompt** theo role (mission, phạm vi, format), (2) **Agent Catalog** (intent, capability, output schema), (3) **MCP tool allowlist** đúng domain, (4) **RAG** chuyên biệt có citation. Nghiệp vụ ngân hàng nằm ở prompt + catalog + tool + tài liệu — không nằm trong trọng số model. Fine-tune / private model là lộ trình sau khi có dữ liệu nội bộ đã duyệt (§3.5.1, §5.4D).

### 12.16h “Đề xuất Vector+BM25+Graph+Versioning+Conflict Detector cho văn bản pháp lý — có áp dụng được không?”

> Bài toán đúng và đáng đưa vào pitch: quy định SBV/SHB bị sửa đổi nhiều lần, trích dẫn nhầm điều khoản hết hiệu lực là rủi ro thật. Chúng tôi áp dụng **bản lite**: hybrid vector + Postgres full-text (thay BM25 engine riêng), một bảng `DocumentRelation` ghi quan hệ "văn bản A sửa văn bản B" (thay Graph DB), field `effectiveFrom/To` + `status` để lọc bản còn hiệu lực (Versioning Engine lite), và để LLM tự chọn bản mới nhất khi trích dẫn thay vì xây model Conflict Detector riêng. Vẫn kể được đúng câu chuyện, với chi phí phù hợp 48h.

### 12.16i “Có cần chức năng Group hay tạo session mới như Aucobot không?”

> Không. Aucobot cho user tự thêm nhiều bot vào 1 room (Group) và quản lý nhiều thread song song. Ở đây, chọn chuyên gia là việc của **Planner có kiểm soát** (§2, §2.5) — người dùng không tự lắp bot vào phòng, nên khái niệm Group không áp dụng. "Session" tương đương 1 `TaskRun`: gửi yêu cầu mới là tạo TaskRun mới, không cần hệ thống thread/rename/archive. Toàn bộ hệ thống chỉ cần dựng **1 Planner (hạ tầng, ẩn) + 4 Specialist cố định** (Credit/Legal/Product/Ops); kịch bản demo chính chạy 3 (Credit ‖ Legal → Product), Ops là off-script/optional (§2.8).

### 12.16j “Cho user tạo nhiều session, mỗi session chat thẳng với 1 agent expert — có nên không?”

> Không nên. Ý này tái tạo đúng mô hình Group đã đánh giá và loại (§2.8): cần thêm session↔agent binding, agent picker UI, lịch sử riêng theo từng session-agent — gấp đôi bề mặt phải build trong 48h, và quan trọng hơn, nó **xóa mất chính giá trị đề bài chấm** (Planner điều phối, so sánh single vs multi) vì bản chất "chat thẳng 1 agent" chính là baseline single-agent, không phải trải nghiệm chính. Nhu cầu thật phía sau — muốn hỏi nhanh câu đơn miền, hoặc muốn thử chat bỏ qua Planner — giải đúng bằng hai cơ chế đã có sẵn: (1) Planner tự sinh `TaskPlan` chỉ 1 step khi câu hỏi đơn miền, UI hiện gọn như "1 chuyên gia trả lời"; (2) lộ baseline single-agent (đã thiết kế cho deliverable so sánh, §8) thành 1 toggle UI thật, không cần xây hệ thống session/routing mới.

### 12.17 “Production-ready chưa?”

> Bản demo chứng minh đúng các **seam kiểm soát** ngân hàng cần: trace end-to-end, approval trước hành động, user bật/tắt automation, tool allowlist, citation, ranh giới MCP. Auth/RBAC/Vault là lớp tích hợp hạ tầng SHB — nhóm cố ý không làm trong hackathon để dồn effort vào multi-agent + action execution, nhưng kiến trúc đã chừa chỗ (không cần đập đi xây lại).

### 12.18 “Có tự tạo agent không?”

> Có — Specialist tự spawn worker (ephemeral agents) cho tác vụ song song, rồi tự tổng hợp. Không tạo vô hạn agent vĩnh viễn. Độ sâu tối đa = 1; ≤3 worker/step; worker không được mutate.

### 12.19 Câu kết khi bị hỏi dồn về stack

> Chúng tôi tối ưu cho **khả năng kiểm soát và khả năng thay thế**, không tối ưu để trình diễn số lượng framework. Phần có giá trị là plan có cấu trúc, collaboration có giới hạn, RAG có citation, action có approval, automation có user bật/tắt, MCP có suite + registry, và trace end-to-end. Stack hiện tại giúp chứng minh các năng lực đó ổn định trong thời gian thi, đồng thời giữ đường thay thế sang Python hoặc hạ tầng nội bộ SHB qua contract chuẩn.
