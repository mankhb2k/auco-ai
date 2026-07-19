# Auco AI — NestJS Backend (One Job)

Backend cho app **đánh giá yêu cầu khoản vay**: LoanRequest → TaskRun (Credit ‖ Legal ‖ Collateral → Product) → nhân viên gắn nhãn/trình → Giám đốc quyết định. MCP/RAG/LLM là **internal providers**, không có public admin API. Audit chỉ có 1 endpoint đọc có kiểm soát (`GET /api/audit-events`), không có admin API tổng quát.

## Local

```bash
npm run docker:up
cp .env.example .env
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

Health: [http://localhost:8387/health](http://localhost:8387/health)

## Public API (giữ lại)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | DB / Redis / LLM config |
| `GET` | `/api/actors` | Role switcher demo |
| `GET` | `/api/loan-requests` | Hàng đợi theo actor |
| `GET` | `/api/loan-requests/:id` | Chi tiết + assessment TaskRun |
| `POST` | `/api/loan-requests/intake` | Giả lập yêu cầu từ app ngân hàng |
| `POST` | `/api/loan-requests/:id/assign` | Giám đốc phân bổ |
| `POST` | `/api/loan-requests/:id/start-assessment` | Tạo TaskRun đánh giá (async) |
| `POST` | `/api/loan-requests/:id/assessment-tag` | Nhân viên gắn nhãn kết luận |
| `POST` | `/api/loan-requests/:id/submit-approval` | Trình Giám đốc |
| `POST` | `/api/loan-requests/:id/approve` | Phê duyệt / escalate >5 tỷ |
| `POST` | `/api/loan-requests/:id/reject` | Từ chối |
| `POST` | `/api/loan-requests/:id/return-for-info` | Trả bổ sung |
| `POST` | `/api/loan-requests/:id/reveal-customer-pii` | Hiện CMND/số dư đầy đủ — luôn ghi `AuditEvent` |
| `GET` | `/api/audit-events` | Lịch sử theo `resource=LoanRequest:<id>` hoặc `actorId` (employee chỉ xem của mình) |
| `POST` | `/api/task-runs` | Ask AI / assessment (luôn `skipApprovalPropose`) |
| `GET` | `/api/task-runs/:id` | Polling tiến trình DAG |
| `GET` | `/api/knowledge/documents` | Tra cứu tri thức |
| `GET` | `/api/knowledge/documents/:id` | Chi tiết tài liệu |
| `POST` | `/api/knowledge/documents/sync` | Đồng bộ HQ mock → RAG |
| `GET` | `/api/bank-hq/knowledge` | Nguồn tri thức giả lập hội sở |

## Đã gỡ khỏi sản phẩm

- Automations + scheduler
- Compare single vs multi
- Generic TaskStep approvals + WebSocket
- Public `/api/rag/*`, `/api/mcp/*`, `/api/llm/*`
- Knowledge create/update/publish + curator/ingest proposals

Maker–checker chính thức nằm trên **LoanRequest**, không còn HITL generic trên TaskStep.

## Internal (không public)

- `SpecialistService` → MCP gateway + RAG `kbTool`
- `KnowledgeSyncService` → `IngestService` (pgvector)
- `computePolicyGate()` (`planning/service/policy-gate.ts`) — rule cứng LTV/AML ép `TaskRun.suggestedAssessmentTag`, chạy độc lập với LLM synthesize
- `AuditService.recordSafe` khi tạo TaskRun / quyết định hồ sơ / sync HQ / xem PII (`pii_reveal`) — đọc qua `GET /api/audit-events`
- `LlmGatewayService` cho Planner synthesize (fallback deterministic)

## MCP servers (stdio)

| Server | Tools chính |
|---|---|
| `mcp-los` | eligibility, collateral package, credit helpers |
| `mcp-compliance` | AML, regulation search |
| `mcp-core-banking` | score / history (stub/mock) |
| `mcp-product` | compare products |
| `mcp-ops` | ngoài pipeline thẩm định |

## Demo goals (pinned DAG)

- Vay nhà: `KH Nguyễn Văn An muốn vay mua nhà 2 tỷ`
- DN: `SHB Mekong vay 50 tỷ nhà máy — Thông tư 39`
- FX: `Trần Thị Bình nắm giữ USD lớn`

DAG: **Credit ‖ Legal ‖ Collateral → Product**.
