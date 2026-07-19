# AUCO AI — Đội ngũ chuyên gia số đánh giá yêu cầu khoản vay

> Hack CX Together 2026 · Đề bài SHB
> Repo: `frontend/` (Next.js) + `backend/` (NestJS)

AUCO AI làm **đúng một việc**: nhận yêu cầu vay của một khách hàng, điều phối các chuyên gia số (Credit, Compliance/Legal, Collateral, Product) để phân tích, rồi trả về một **`LoanAssessment`** có căn cứ, có trích dẫn — làm gợi ý tham khảo cho nhân viên tín dụng. Quyết định cuối cùng luôn thuộc về con người theo mô hình maker–checker (nhân viên trình → Giám đốc duyệt).

Nguồn sự thật kỹ thuật: **[`ARCHITECTURE.md`](ARCHITECTURE.md)**. Tài liệu này chỉ là cổng vào — tóm tắt kiến trúc, cách chạy local, và các giới hạn demo cần biết trước khi test.

## 1. Luồng nghiệp vụ

```text
App ngân hàng (giả lập) → LoanRequest chưa phân bổ
                        → Giám đốc phân cho nhân viên tín dụng
                        → Nhân viên bấm "Chạy đánh giá"
                        → Orchestrator chạy song song:
                              Credit Expert ─┐
                              Compliance     ─┼─→ Product Expert → LoanAssessment
                              Collateral    ─┘
                        → AI đề xuất assessmentTag + trả lời trong panel Trợ lý AI
                        → Nhân viên xác nhận nhãn, ghi ý kiến, trình duyệt
                        → Giám đốc: phê duyệt / từ chối / trả bổ sung
                        → (> 5 tỷ VND) tự động escalated lên cấp trên
```

- **Credit Expert** — khả năng trả nợ, CIC, dư nợ tại TCTD khác, DTI/LTV.
- **Compliance Expert** — KYC/AML, danh sách đen, quy định pháp luật.
- **Collateral Expert** — LTV thực tế, quyền sở hữu, đăng ký GDBĐ, độ mới định giá.
- **Product Expert** — chỉ chạy sau khi ba chuyên gia trên xong; đề xuất sản phẩm phù hợp.

Mỗi chuyên gia tự phân tích dữ liệu bằng LLM trước khi Orchestrator tổng hợp câu trả lời cuối — không có expert nào trả nguyên dữ liệu thô. Mọi kết luận về chính sách phải có trích dẫn từ RAG (`backend/data/mock/bank-hq-knowledge.json`, xem [`DEMO_RAG.md`](DEMO_RAG.md)); AI không tự "nhớ" quy định bằng trọng số model.

Chi tiết đầy đủ (data model, trách nhiệm từng expert, nguyên tắc triển khai): [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 2. Vì sao "One Job" — không phải kiến trúc multi-agent tổng quát

Đề bài gốc gợi ý một hệ multi-agent tổng quát (Credit/Legal/Product/Ops, Planner tự sinh DAG cho mọi loại yêu cầu, Automation lặp lịch, Dashboard so sánh single vs multi). Nhóm đã cân nhắc và **chủ động thu hẹp phạm vi** về đúng một bài toán nghiệp vụ để tránh over-engineer trong thời gian thi:

| Giữ | Bỏ khỏi runtime hiện tại |
|---|---|
| Orchestrator điều phối 4 chuyên gia cố định cho đúng 1 nghiệp vụ (thẩm định khoản vay) | Planner sinh DAG động cho nghiệp vụ tuỳ ý |
| Maker–checker thật trên `LoanRequest` (trình → duyệt/từ chối/trả bổ sung/escalate) | Generic `TaskStep` approval + WebSocket realtime |
| RAG có domain, versioning, citation | Automations lặp lịch + scheduler |
| MCP nội bộ cho Credit/Compliance/Collateral/Product | Public MCP/RAG/LLM/Audit admin API, Dashboard so sánh single vs multi |
| 3 nhân viên tín dụng + 1 Giám đốc (demo impersonation) | Vai trò IT Admin / Ops Officer (không có việc cụ thể trong phạm vi này) |

Lý do đầy đủ và các quyết định đã cân nhắc: xem lịch sử thảo luận trong `ARCHITECTURE.md` §1, §8, §9.

## 3. Chạy local

Yêu cầu: Node 20+, Docker Desktop.

```bash
# 1. Backend
cd backend
npm install
npm run docker:up            # Postgres + Redis (docker-compose.yml)
cp .env.example .env         # điền OPENAI_API_KEY / GEMINI_API_KEY để test LLM thật
npx prisma migrate deploy
npm run prisma:seed          # seed 4 nhân viên, khách hàng, 45 LoanRequest, tri thức RAG
npm run start:dev            # http://localhost:8387
```

```bash
# 2. Frontend (terminal khác)
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8387
npm run dev                  # http://localhost:3000
```

Kiểm tra nhanh: `GET http://localhost:8387/health` phải trả `db`/`redis`/`llm` đều ok. Không cấu hình `OPENAI_API_KEY`/`GEMINI_API_KEY` thì hệ thống vẫn chạy được nhờ fallback deterministic, nhưng phần phân tích của từng chuyên gia sẽ không phải LLM thật — nên điền key khi cần demo phân tích thật.

Không có đăng nhập: đổi vai trò bằng dropdown trên UI (gửi header `X-Demo-Employee-Id`), tương ứng 3 Chuyên viên tín dụng + 1 Giám đốc đã seed sẵn.

## 4. Cấu trúc thư mục

```text
auco-ai/
├── ARCHITECTURE.md            # nguồn sự thật kiến trúc + data model + expert responsibilities
├── DEMO_RAG.md                 # 4 kịch bản demo RAG dùng khi trình bày
├── frontend/                   # Next.js — Loan queue, panel Trợ lý AI, tab Tri thức
│   └── src/{app,components,stores,lib}/
└── backend/                    # NestJS
    ├── prisma/                 # schema + migrations + seed
    ├── src/
    │   ├── loan-requests/       # queue + maker-checker workflow
    │   ├── planning/            # Orchestrator, Planner synthesize, TaskRun/TaskStep
    │   ├── agents/               # Agent catalog + Specialist (Credit/Compliance/Collateral/Product)
    │   ├── mcp-client/           # MCP registry/gateway (nội bộ, không public)
    │   ├── rag/                  # ingest + retrieve + embeddings (LlamaIndex.TS + pgvector)
    │   ├── knowledge/            # sync tri thức từ HQ mock + thư viện tra cứu
    │   ├── llm/                  # LLM gateway (OpenAI primary, Gemini fallback)
    │   └── audit/                 # audit log cho quyết định hồ sơ
    ├── mcp-servers/              # mcp-los, mcp-compliance, mcp-core-banking, mcp-product, mcp-ops
    └── data/mock/                # customers.json, bank-hq-knowledge.json (RAG demo)
```

## 5. API còn public

| Method | Path | Ghi chú |
|---|---|---|
| `GET` | `/health` | DB / Redis / LLM config |
| `GET` | `/api/actors` | Danh sách nhân viên demo để đổi vai trò |
| `GET` | `/api/loan-requests` | Hàng đợi theo actor |
| `GET` | `/api/loan-requests/:id` | Chi tiết + assessment TaskRun |
| `POST` | `/api/loan-requests/intake` | Giả lập yêu cầu vay từ app ngân hàng |
| `POST` | `/api/loan-requests/:id/assign` | Giám đốc phân bổ cho nhân viên |
| `POST` | `/api/loan-requests/:id/start-assessment` | Tạo `TaskRun` đánh giá (async) |
| `POST` | `/api/loan-requests/:id/assessment-tag` | Nhân viên gắn nhãn kết luận |
| `POST` | `/api/loan-requests/:id/submit-approval` | Trình Giám đốc |
| `POST` | `/api/loan-requests/:id/approve` \| `/reject` \| `/return-for-info` | Giám đốc quyết định |
| `POST` | `/api/loan-requests/:id/reveal-customer-pii` | Hiện CMND/số dư đầy đủ — luôn ghi `AuditEvent` |
| `GET` | `/api/audit-events` | Lịch sử xử lý theo hồ sơ (`resource=LoanRequest:<id>`) hoặc theo actor |
| `POST` | `/api/task-runs` | Panel Trợ lý AI gửi câu hỏi / chạy đánh giá |
| `GET` | `/api/task-runs/:id` | Polling tiến trình DAG |
| `GET` | `/api/knowledge/documents`, `/:id` | Tra cứu thư viện tri thức |
| `POST` | `/api/knowledge/documents/sync` | Đồng bộ tri thức từ HQ mock → RAG |
| `GET` | `/api/bank-hq/knowledge` | Nguồn tri thức giả lập của hội sở |

MCP, RAG, LLM và Audit chạy nội bộ cho các Expert — không có admin API public cho các domain này. Chi tiết đầy đủ + endpoint đã gỡ: [`ARCHITECTURE.md §7.1`](ARCHITECTURE.md), [`backend/README.md`](backend/README.md).

## 6. Bảo mật & giới hạn của bản demo (khai báo chủ động)

Đây là bản demo cho một cuộc thi, không phải hệ thống production. Các giới hạn dưới đây là **quyết định có chủ đích** để dồn thời gian cho multi-agent/RAG/workflow, không phải sơ suất:

| Hạng mục | Demo hiện tại | Hướng production |
|---|---|---|
| Đăng nhập | Không có — chọn nhân viên qua header `X-Demo-Employee-Id`, không phải auth thật | OIDC/SSO, JWT, RBAC theo `accessLayer` đã có seam |
| Phân quyền dữ liệu khách hàng | Có mô phỏng nhẹ (`CustomerPortfolio` theo nhân viên) | RBAC/ABAC đầy đủ + audit truy cập |
| PII trên UI | CMND/số dư khả dụng **che theo mặc định** (`nationalIdMasked`, `availableBalanceMasked`); nhân viên phải bấm "Hiện đầy đủ" mới thấy số thật, và hành động này luôn ghi `AuditEvent` (`loan_request.pii_reveal`) | Data classification đầy đủ theo field + masking theo vai trò, DLP |
| Nguồn dữ liệu | Mock (`data/mock/*.json`) + 7 văn bản pháp luật/sản phẩm crawl thật từ nguồn công khai | Kết nối CIC/LOS/core banking thật của ngân hàng qua MCP adapter |
| Model | OpenAI primary, Gemini fallback, do platform quản qua `.env` — nhân viên không đổi model/không BYOK | Model gateway nội bộ / on-prem trong VPC ngân hàng |
| Rule cứng vs LLM | Có **policy gate deterministic** chạy sau khi 3 chuyên gia xong (`backend/src/planning/service/policy-gate.ts`): LTV vượt ngưỡng chính sách hoặc AML không "clear" sẽ luôn ép `manual_review`/`recommend_reject`, LLM không thể override — xem `TaskRun.suggestedAssessmentTag` + `policyGateReasons` | Rule engine tách riêng (OPA/Drools...), versioned theo văn bản chính sách |
| Audit | Ghi `AuditEvent` cho toàn bộ hành động trên hồ sơ (tiếp nhận/phân bổ/đánh giá/trình/duyệt/xem PII) + sync tri thức; xem được qua `GET /api/audit-events` và card "Lịch sử xử lý" trong chi tiết hồ sơ | Immutable audit log, giám sát tập trung, SIEM |
| Đa ngân hàng | `bankCode` là seam trên mọi model lõi, demo chỉ seed `"SHB"` | Thêm ngân hàng = seed + connector mới, không migrate schema |

## 7. Tài liệu liên quan

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — kiến trúc, data model, trách nhiệm từng expert, nguyên tắc triển khai, ngoài phạm vi.
- [`DEMO_RAG.md`](DEMO_RAG.md) — 4 kịch bản demo RAG (vay mua nhà, doanh nghiệp vượt hạn mức, cảnh báo AML, thiếu hồ sơ TSĐB).
- [`backend/README.md`](backend/README.md) — chi tiết chạy backend, MCP servers, danh sách API đầy đủ, goal demo pinned DAG.
