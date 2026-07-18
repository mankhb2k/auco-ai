# Role & Dashboard Plan — Phân 3 lớp quyền (demo)

> Tài liệu triển khai: mô phỏng phân vai **IT / Trưởng phòng / Nhân viên**.  
> **Không** làm auth thật (JWT/SSO/password) — khớp README §2.7 / §9.5.  
> Mục tiêu: đủ API + UI switch vai để demo & pitch governance; seam sẵn cho production.

---

## 0. Quyết định đã chốt cho bản demo

| # | Quyết định | Lý do |
|---|---|---|
| 1 | **3 lớp quyền (access layer)**, không RBAC engine tổng quát | Đủ kể chuyện scale multi-bank; chi phí thấp |
| 2 | **Không login** — FE dropdown/`X-Demo-Employee-Id` chọn employee seed | Giống §2.7; giám khảo hiểu “cố ý mô phỏng” |
| 3 | **Một backend, nhiều surface UI** theo layer (có thể 1 Dashboard + role switch) | Không tách 3 app trong 48h |
| 4 | Agent catalog **ship sẵn** — trưởng phòng **không** tạo/xóa agent | Chỉ publish RAG + (tuỳ chọn) bind team↔domain |
| 5 | IT quản **MCP connector view** (read + mock patch status); không sửa code runtime | Demo “IT gắn đường ống” |
| 6 | Approval duyệt side-effect = **branch_manager** (lớp Trưởng phòng / Approver) | Tái dùng Approvals API đã có |

---

## 1. Ba lớp quyền (Access Layer)

```text
┌─────────────────────────────────────────────────────────────┐
│  L1 — IT / Platform                                         │
│  MCP connector, suite status, (sau) model gateway config    │
├─────────────────────────────────────────────────────────────┤
│  L2 — Manager / Knowledge owner                             │
│  Tài liệu RAG (draft→publish), version, Approval duyệt HITL │
├─────────────────────────────────────────────────────────────┤
│  L3 — Employee / Operator                                   │
│  Chat TaskRun, xem trace/DAG, portfolio scope               │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Code | Ai (seed demo) | Trách nhiệm | Không được |
|---|---|---|---|---|
| **IT** | `it_admin` | “Trần IT — Platform SHB” | Xem MCP Suite, bật/tắt connector (mock), xem health/llm status | Upload KB production; chạy TaskRun nghiệp vụ |
| **Manager** | `manager` | “Lê Quản lý — Trưởng phòng / Risk” | Upload/list/publish KnowledgeDocument; duyệt Approval | Đổi MCP entry URL; gọi tool ngoài policy |
| **Employee** | `employee` | “Nguyễn Thị B — CV Tín dụng” (và ops/compliance officer) | Tạo TaskRun, xem task/compare; chỉ KH trong portfolio | Publish KB; sửa connector |

### Map với `Employee.role` hiện có (schema)

Giữ field `Employee.role` (job role nghiệp vụ). Thêm field **`accessLayer`** (hoặc derive):

| `accessLayer` | `Employee.role` gợi ý (seed) | Ghi chú |
|---|---|---|
| `it_admin` | `it_admin` *(mới)* | 1 user seed |
| `manager` | `branch_manager` | Duyệt Approval + Knowledge publish |
| `employee` | `credit_officer` \| `compliance_officer` \| `ops_officer` | Thực thi |

**Không** nhầm `Employee.role` (credit_officer…) với **AgentRole** catalog (`credit` \| `legal` \| `product` \| `ops`).  
Nhân viên tín dụng vẫn để **Planner** chọn multi-agent; quyền của họ là **được mở Execution UI + portfolio**, không phải “chỉ được gọi Credit Agent” trong demo chính (tránh phá deliverable Planner).

> Tuỳ chọn sau demo: `TeamAgentBinding` hạn chế agent theo team. **Ngoài scope bản demo này.**

---

## 2. UX Demo (1 Dashboard + Role Switcher)

```text
[ Banner ] Đang dùng: {displayName} — {accessLayer} — {branch}
[ Switch ] dropdown 3–5 employee seed (không password)
[ Nav theo layer ]
  employee → Chat | Tasks | Compare | Approvals (read nếu không phải manager)
  manager  → Knowledge | Approvals | (read-only Tasks)
  it_admin → MCP Suite | Health/LLM | (read-only Knowledge count)
```

Header mọi API demo: `X-Demo-Employee-Id: <employeeId>`  
(FE set từ dropdown; thiếu header → employee mặc định seed `credit_officer`.)

---

## 3. Schema seam (migration nhẹ)

### 3.1 Mở rộng `Employee`

```prisma
model Employee {
  id           String   @id @default(cuid())
  bankCode     String   @default("SHB")
  displayName  String
  role         String   // credit_officer | compliance_officer | ops_officer | branch_manager | it_admin
  accessLayer  String   @default("employee") // it_admin | manager | employee
  branchCode   String?
  // ...
}
```

### 3.2 Knowledge publish (manager)

Tận dụng `KnowledgeDocument` hiện có; thêm nếu thiếu:

| Field | Ý nghĩa |
|---|---|
| `status` | `draft` \| `active` \| `superseded` *(đã có hướng này)* |
| `uploadedById` | Employee manager upload |
| `publishedAt` | Khi chuyển `draft` → `active` |

Ingest **chỉ** chunk document `status = active` (hoặc ingest lại sau publish).

### 3.3 Không làm trong demo

- Bảng `Permission` / `RolePermission` matrix  
- `Team` / `TeamAgentBinding`  
- JWT, refresh token, SSO  

---

## 4. Guard mô phỏng (Nest)

```text
DemoActorMiddleware / DemoActorGuard
  1. Đọc X-Demo-Employee-Id
  2. Load Employee (+ accessLayer)
  3. Attach request.actor = { id, accessLayer, role, bankCode }
  4. @RequireLayer('manager' | 'it_admin' | 'employee')
     → 403 nếu sai layer (message rõ cho demo)
```

Scope portfolio (đã thiết kế §2.7): trước MCP cần `customerId` → check `CustomerPortfolio`; ngoài danh mục → `waiting_approval` + reason `out_of_portfolio_access`.

---

## 5. API cần có — đủ demo

### 5.1 Actors / Session mô phỏng — **mới**

| Method | Path | Layer | Mô tả |
|---|---|---|---|
| `GET` | `/api/actors` | all | List employee seed (id, displayName, role, accessLayer, branch) |
| `GET` | `/api/actors/me` | all | Actor hiện tại theo header |
| `GET` | `/api/actors/:id/portfolio` | employee+ | Danh sách KH trong portfolio (demo scope) |

### 5.2 Execution — **đã có**, gắn `employeeId`

| Method | Path | Layer | Ghi chú demo |
|---|---|---|---|
| `POST` | `/api/task-runs` | `employee` | Bắt buộc gắn `employeeId` = actor |
| `GET` | `/api/task-runs` | `employee`, `manager` | Manager xem được (audit) |
| `GET` | `/api/task-runs/:id` | `employee`, `manager` | |
| `POST` | `/api/compare` | `employee` | Giữ deliverable so sánh |

### 5.3 Approval — **đã có**, siết layer

| Method | Path | Layer | Ghi chú |
|---|---|---|---|
| `GET` | `/api/approvals` | `manager` (+ employee read optional) | Pending steps |
| `POST` | `/api/approvals/:stepId/approve` | `manager` | Actor = branch_manager |
| `POST` | `/api/approvals/:stepId/reject` | `manager` | |

### 5.4 Knowledge (RAG publish) — **mở rộng** từ RAG hiện có

| Method | Path | Layer | Mô tả |
|---|---|---|---|
| `GET` | `/api/knowledge/documents` | `manager`, `it_admin` (read) | Filter domain, status |
| `GET` | `/api/knowledge/documents/:id` | `manager`, `it_admin` | Chi tiết |
| `POST` | `/api/knowledge/documents` | `manager` | Tạo `draft` (title, domain, content, bankCode) |
| `PATCH` | `/api/knowledge/documents/:id` | `manager` | Sửa draft |
| `POST` | `/api/knowledge/documents/:id/publish` | `manager` | `draft`→`active` + trigger ingest doc/bank |
| `POST` | `/api/knowledge/documents/:id/supersede` | `manager` | Optional: gắn quan hệ supersedes |
| `POST` | `/api/rag/search` | `employee`, `manager` | Giữ search/citation (đã có) |
| `POST` | `/api/rag/ingest` | `it_admin` hoặc `manager` sau publish | Full re-ingest bank — hạn chế gọi tay |

> FE Manager: form text/markdown là đủ; **không** cần OCR→KB.

### 5.5 IT / MCP — **đã có + siết**

| Method | Path | Layer | Mô tả |
|---|---|---|---|
| `GET` | `/api/mcp/suite` | `it_admin` (+ manager read-only ok) | Connector list, tools, implementation |
| `PATCH` | `/api/mcp/connectors/:capability` | `it_admin` | **Mock:** `enabled: true\|false` (in-memory / Redis), không đổi code MCP |
| `GET` | `/api/health` | `it_admin` | DB / Redis / LLM |
| `GET` | `/api/llm/status` | `it_admin` | Primary/fallback configured |

### 5.6 Automations — tuỳ chọn demo

| Method | Path | Layer | Ghi chú |
|---|---|---|---|
| `GET/PATCH/POST …/automations` | `manager` hoặc `employee` ops | Giữ như hiện tại; ưu tiên sau 5.1–5.5 |

---

## 6. Ma trận quyền API (demo)

| API group | it_admin | manager | employee |
|---|---|---|---|
| Actors list/me | ✅ | ✅ | ✅ |
| TaskRuns create | ❌ | ❌ | ✅ |
| TaskRuns read | ✅ read | ✅ | ✅ |
| Compare | ❌ | ❌ | ✅ |
| Approvals decide | ❌ | ✅ | ❌ |
| Knowledge draft/publish | ❌ | ✅ | ❌ |
| RAG search | ✅ | ✅ | ✅ |
| MCP suite + patch enable | ✅ | read | ❌ |
| Health / LLM status | ✅ | ❌ | ❌ |

`403` body gợi ý demo:

```json
{
  "statusCode": 403,
  "message": "Layer manager required (actor is employee)",
  "actorId": "...",
  "accessLayer": "employee"
}
```

---

## 7. Seed demo (tối thiểu)

| id (ví dụ) | displayName | accessLayer | role |
|---|---|---|---|
| `emp-it` | Trần IT — Platform SHB | `it_admin` | `it_admin` |
| `emp-mgr` | Lê Quản lý — CN Cầu Giấy | `manager` | `branch_manager` |
| `emp-credit` | Nguyễn Thị B — CV Tín dụng | `employee` | `credit_officer` |
| `emp-ops` | Phạm Ops — CV Vận hành | `employee` | `ops_officer` |

- Portfolio: `emp-credit` có SHB-KH-1001; **không** có 1 KH “ngoài danh mục” để demo Approval `out_of_portfolio_access`.  
- Knowledge: 1 doc `draft` sẵn để manager bấm Publish trên UI.

---

## 8. Kịch bản demo giám khảo (5 phút)

1. **Switch → Nhân viên tín dụng** → chat vay nhà → DAG Credit‖Legal→Product → citation RAG.  
2. Hỏi KH **ngoài portfolio** → step `waiting_approval` / out_of_portfolio.  
3. **Switch → Trưởng phòng** → Approvals → Duyệt.  
4. Cùng Manager → Knowledge → Publish doc LTV mới → (ingest) → nhân viên hỏi lại thấy citation mới.  
5. **Switch → IT** → MCP Suite → tắt mock `ops` → giải thích “IT gắn/tháo đường ống, không đụng tri thức”.

---

## 9. Phases triển khai

### Phase R1 — Seam + Actors (P0)

- [x] Migration `Employee.accessLayer` + seed 4 employee  
- [x] `GET /api/actors`, `GET /api/actors/me`  
- [x] Middleware `X-Demo-Employee-Id`  
- [x] FE dropdown role switcher trên Dashboard  

### Phase R2 — Guard API hiện có (P0)

- [x] `@RequireLayer` trên TaskRuns create, Approvals decide, MCP suite  
- [x] TaskRun luôn ghi `employeeId` từ actor  
- [x] (Nếu chưa có) portfolio check → Approval reason `out_of_portfolio_access`  

### Phase R3 — Knowledge Manager API (P0 cho câu chuyện RAG)

- [x] Module `knowledge` (CRUD draft + publish)  
- [x] Publish → ingest document/bank  
- [x] FE tab Knowledge (manager only)  

### Phase R4 — IT connector mock (P1)

- [x] `PATCH /api/mcp/connectors/:capability` enable flag  
- [x] Gateway tôn trọng flag khi `callTool`  
- [x] FE tab MCP Suite (it_admin)  

### Phase R5 — Polish (P2)

- [x] Nav ẩn theo layer  
- [x] Audit log đơn giản: `{ actorId, action, resource, at }` JSON hoặc bảng `AuditEvent`  
- [x] README / slide: sơ đồ 3 lớp  

---

## 10. Cấu trúc code gợi ý

```text
backend/src/
  actors/
    actors.module.ts
    actors.controller.ts
    service/actors.service.ts
    service/actors.test.service.ts
  common/
    demo-actor.middleware.ts
    require-layer.decorator.ts
    require-layer.guard.ts
  knowledge/                    # hoặc mở rộng rag/
    knowledge.module.ts
    knowledge.controller.ts
    service/knowledge.service.ts
    service/knowledge.test.service.ts
```

FE: `RoleSwitcher` + route/nav `visibleIfLayer`.

---

## 11. Tiêu chí “xong demo”

- [x] Đổi 3 vai trên UI **không** reload mất context banner  
- [x] Employee tạo task được; IT/Manager **bị 403** khi POST task-runs  
- [x] Chỉ Manager approve/reject  
- [x] Manager publish 1 doc → search/citation phản ánh (sau ingest)  
- [x] IT xem MCP suite; (P1) tắt capability thấy tool fail rõ  
- [x] Không có màn login/password  

---

## 12. Ngoài scope (nói rõ với giám khảo)

- Auth thật / SSO / MFA  
- RBAC matrix động, Agent Studio end-user  
- Multi-tenant SaaS shared DB  
- Team-level agent binding  
- OCR đưa ảnh vào Knowledge base  

**Câu chốt:**

> IT gắn MCP, Trưởng phòng xuất bản RAG có kiểm soát, Nhân viên thực thi trên portfolio được giao — ba lớp quyền, một platform, chưa cần login để chứng minh đúng nguyên tắc ngân hàng.
