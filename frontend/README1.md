# Digital Expert Agents - Governed Hybrid Multi-Agent

> Hack CX Together 2026 - De bai SHB  
> Muc tieu 20h: demo chay duoc, dung de bai, co trace, co tool/action that tren mock system, co approval va co so sanh single-agent vs multi-agent.  
> Tai lieu nay la phien ban kien truc moi theo mong muon: giu nguyen stack da chot, chi dieu chinh agent architecture, luong xu ly va state model.

---

## 1. Dinh Huong Moi

README goc da chot dung stack va nhieu thanh phan tot: Next.js, NestJS, Vercel AI SDK, LlamaIndex.TS, PostgreSQL/pgvector, Prisma, MCP Suite, approval, audit va dashboard. Tuy nhien, voi thoi gian hackathon 20h, kien truc can tap trung vao diem an diem cua de bai:

1. Multi-agent co planner chia viec cho nhieu specialist.
2. Agent co dung tool/RAG, khong chi tra loi text.
3. Co hanh dong that tren he thong van hanh mock.
4. Dashboard nhin thay trace, trang thai, quyet dinh, approval.
5. Co so sanh single-agent vs multi-agent.

Kien truc moi de xuat la **Governed Hybrid Multi-Agent**:

```text
User Request
      |
      v
Request Classifier
      |
      v
Planner Agent
      |
      v
Specialist Execution Layer
  +-----------+----------------+-------------+
  | Credit    | Compliance     | Product     |
  | Expert    | Expert         | Expert      |
  +-----------+----------------+-------------+
      |
      v
Evidence Aggregator
      |
      v
Conflict & Safety Reviewer
      |
      v
Deterministic Policy Gate
      |
      +----------------+------------------+
      |                |                  |
      v                v                  v
 ANSWER_ONLY     NEED_INFO          WAIT_APPROVAL
                                      |
                                      v
                               Human Approval
                                      |
                                      v
                              Operations Executor
                                      |
                                      v
                                SHB MCP Suite
```

Nguyen tac cot loi:

- LLM lam viec can hieu ngon ngu, lap plan, tong hop nghiep vu.
- Backend deterministic quyet dinh policy, quyen han, trang thai va action gate.
- Specialist chi dua ra ket luan co bang chung, khong tu y thuc thi write action.
- Operations Executor chi chay action tu `ApprovedActionPlan` da qua Policy Gate va human approval.

---

## 2. Stack Giu Nguyen

| Thanh phan | Quyet dinh |
|---|---|
| Frontend | Next.js / React |
| Backend | NestJS / TypeScript |
| Agent loop | Vercel AI SDK |
| RAG | LlamaIndex.TS + PostgreSQL/pgvector |
| MCP | `@modelcontextprotocol/sdk` |
| Database | PostgreSQL + Prisma |
| Realtime | WebSocket |
| Deploy | Frontend Vercel, backend Railway/Docker |
| LLM | OpenAI primary, Gemini fallback |

Khong doi cong nghe trong 20h. Moi thay doi nam o orchestration, state model, dashboard va policy flow.

---

## 3. Van De Cua Luong Cu

Luong cu:

```text
Planner
  |-- Credit
  |-- Legal
  |-- Product
        |
        v
Planner synthesize
        |
        v
Approval
        |
        v
Operations optional
```

Han che:

| Van de | Tac dong |
---|---|
| Planner vua lap ke hoach vua tong hop quyet dinh cuoi | Neu specialist mau thuan, thieu tang doc lap de kiem tra |
| Approval chu yeu dua vao `mutates: true` | Chua kiem tra du bang chung, policy, conflict, trang thai action |
| Operations bi xem la optional | De bai yeu cau agent thuc hien hanh dong tren he thong van hanh, nen phai co trong demo chinh |
| Specialist output de la text tu do | Dashboard va backend kho dua vao de gate action an toan |
| Worker duoc mo ta hoi manh la "tu tao multi-agent" | Nen gioi han ro: worker chi doc, cung domain, khong side-effect |

---

## 4. Thanh Phan Kien Truc Moi

### 4.1 Request Classifier

Khong nhat thiet la agent rieng. Co the la service trong NestJS, ket hop rule va LLM structured output.

```ts
type RequestRisk = "READ_ONLY" | "RECOMMENDATION" | "WRITE_ACTION";
```

Classifier xac dinh:

- request co can action khong;
- muc do rui ro;
- specialist nao can tham gia;
- action nao co the phat sinh;
- co can approval khong.

Vi du:

```text
"Kiem tra khach hang co du dieu kien vay khong"
-> RECOMMENDATION

"Tao ho so vay cho khach hang neu du dieu kien"
-> WRITE_ACTION
```

### 4.2 Planner Agent

Planner chi lam:

- hieu goal;
- chon specialist;
- tao dependency;
- chi ra input con thieu;
- de xuat action neu request co `WRITE_ACTION`.

Planner khong dua ra quyet dinh tin dung/phap ly cuoi.

```ts
const TaskPlanSchema = z.object({
  goal: z.string(),
  riskClass: z.enum(["READ_ONLY", "RECOMMENDATION", "WRITE_ACTION"]),
  steps: z.array(
    z.object({
      id: z.string(),
      agentRole: z.enum(["credit", "compliance", "product"]),
      goal: z.string(),
      dependsOn: z.array(z.string()),
      requiredCapabilities: z.array(z.string()),
    }),
  ),
  proposedAction: z
    .object({
      capability: z.string(),
      operation: z.string(),
    })
    .nullable(),
});
```

Demo khong nen noi DAG "co dinh tuyet doi". Nen noi:

> Demo co expected plan `Credit || Compliance -> Product`. Planner van sinh TaskPlan qua structured output; backend validate theo Agent Catalog. Neu plan khong dat validation hoac lech khoi expected capability graph luc live, he thong dung validated fallback plan.

### 4.3 Specialist Execution Layer

Ba specialist chinh cho demo 20h:

```text
Credit Expert
Compliance Expert
Product Expert
```

Moi specialist tra output co cau truc:

```ts
type SpecialistResult = {
  status: "PASS" | "FAIL" | "CONDITIONAL" | "NEED_MORE_INFORMATION";
  findings: Array<{
    statement: string;
    evidenceIds: string[];
  }>;
  missingInputs: string[];
  risks: string[];
  recommendation: string;
};
```

Quy tac:

- Logic backend dua vao JSON, khong dua vao doan van tu do.
- Doan van tieng Viet chi sinh o cuoi de hien thi.
- Specialist chi de xuat action, khong goi write tool.

#### Credit Expert

Dung:

```text
mcp-core-banking
mcp-los
credit RAG
```

Credit co the spawn toi da 3 ephemeral workers:

```text
Credit Specialist
  |-- Financial Worker
  |-- Credit History Worker
  |-- Eligibility Worker
```

Worker chi duoc:

- doc du lieu;
- goi read-only tool;
- tra structured evidence;
- khong mutate;
- khong spawn tiep;
- khong ra quyet dinh cuoi.

#### Compliance Expert

Dung:

```text
mcp-compliance
legal/compliance RAG
```

Output nen co them policy check:

```ts
{
  status: "NEED_MORE_INFORMATION",
  policyChecks: [
    { policyId: "AML-04", result: "PASS" },
    { policyId: "KYC-02", result: "MISSING_DATA" }
  ],
  blockedActions: ["SUBMIT_LOAN_APPLICATION"]
}
```

Compliance phai noi ro action nao bi chan, khong chi dua recommendation.

#### Product Expert

Dung:

```text
mcp-product
product RAG
```

Product chay sau Credit va Compliance. Chi duoc de xuat san pham co trong knowledge base va khong vi pham compliance.

---

## 5. Evidence Aggregator

Thanh phan moi nen them:

```text
backend/src/evidence/
```

Day la service deterministic trong NestJS, khong can LLM.

Nhiem vu:

- gom citation tu MCP tool va RAG;
- chuan hoa source;
- loai evidence trung;
- kiem tra version/effective date;
- lien ket finding voi bang chung;
- tinh muc do day du cua evidence.

Data model:

```prisma
model Evidence {
  id          String   @id @default(cuid())
  taskRunId   String
  taskStepId  String?
  agentRole   String
  sourceType  String   // mcp_tool | rag_document | user_input
  sourceName  String
  sourceRef   String
  documentId  String?
  section     String?
  version     String?
  effectiveAt DateTime?
  payloadHash String?
  createdAt   DateTime @default(now())
}
```

Moi finding phai co `evidenceIds`.

```json
{
  "statement": "Khach hang khong co khoan tra cham trong 12 thang",
  "evidenceIds": ["EV-001"]
}
```

Gia tri demo: Dashboard co the hien ro `ket luan -> bang chung -> tool/tai lieu nguon`.

---

## 6. Conflict & Safety Reviewer

Reviewer khong phai "agent tranh luan tu do". No gom 2 lop.

### 6.1 Deterministic Conflict Checks

NestJS check cac conflict ro rang bang code.

```ts
if (
  credit.status === "PASS" &&
  compliance.blockedActions.includes("SUBMIT_LOAN_APPLICATION")
) {
  conflicts.push({
    type: "ACTION_BLOCKED_BY_COMPLIANCE",
    severity: "HIGH",
  });
}
```

Rule tieu bieu:

| Dieu kien | Ket qua |
|---|---|
| Credit PASS + Compliance FAIL | Conflict HIGH |
| Product recommendation khong co citation | Invalid recommendation |
| Write action thieu approval | Block |
| Policy document het hieu luc | Need human review |
| Compliance NEED_MORE_INFORMATION | Khong cho submit loan |

### 6.2 LLM Reviewer Gioi Han

Chi dung LLM reviewer cho cac viec kho viet rule:

- ket luan co mau thuan ve ngu nghia khong;
- recommendation co vuot qua evidence khong;
- final summary co them thong tin khong co trong evidence khong.

Output:

```ts
const ReviewResultSchema = z.object({
  status: z.enum([
    "APPROVED",
    "NEED_MORE_INFORMATION",
    "HUMAN_REVIEW_REQUIRED",
    "REJECTED",
  ]),
  conflicts: z.array(
    z.object({
      type: z.string(),
      severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
      description: z.string(),
      evidenceIds: z.array(z.string()),
    }),
  ),
  allowedActions: z.array(z.string()),
  blockedActions: z.array(z.string()),
});
```

Reviewer khong duoc goi write tool.

---

## 7. Deterministic Policy Gate

Policy Gate la lop quyet dinh an toan. LLM khong duoc override.

```ts
function evaluatePolicyGate(input: {
  requestRisk: RequestRisk;
  review: ReviewResult;
  proposedAction?: ProposedAction;
  approval?: Approval;
}): GateDecision
```

Output:

```ts
type GateDecision =
  | { status: "ANSWER_ONLY" }
  | { status: "NEED_MORE_INFORMATION"; requiredFields: string[] }
  | { status: "WAITING_APPROVAL"; actionPreview: ActionPreview }
  | { status: "EXECUTION_ALLOWED"; actionPlan: ApprovedActionPlan }
  | { status: "BLOCKED"; reason: string };
```

Rule toi thieu:

| Rule | Decision |
|---|---|
| Compliance FAIL | BLOCKED |
| Compliance NEED_MORE_INFORMATION | NEED_MORE_INFORMATION hoac chi cho tao task bo sung tai lieu |
| `mutates = true` | WAITING_APPROVAL |
| `riskLevel = high` | Human approval bat buoc |
| Reviewer HUMAN_REVIEW_REQUIRED | Khong cho Operations chay |
| Approval rejected | BLOCKED |
| Approval approved + valid action plan | EXECUTION_ALLOWED |

---

## 8. Operations Executor

Operations khong nen la LLM agent tu quyet. Nen la executor deterministic.

Mo ta moi:

> Operations Executor nhan `ApprovedActionPlan`, validate lai contract, kiem tra approval va goi MCP tool dung capability.

Luong:

```text
Specialists
   |
Reviewer
   |
Policy Gate
   |
Human Approval
   |
ApprovedActionPlan
   |
Operations Executor
   |
MCP Tool
```

Schema:

```ts
const ApprovedActionPlanSchema = z.object({
  taskRunId: z.string(),
  actionType: z.enum([
    "CREATE_DOCUMENT_TASK",
    "CREATE_ADVISORY_CASE",
    "SUBMIT_LOAN_APPLICATION",
  ]),
  toolName: z.string(),
  toolInput: z.record(z.unknown()),
  approvedBy: z.string(),
  approvalId: z.string(),
  idempotencyKey: z.string(),
});
```

Operations Executor phai:

- kiem tra tool allowlist;
- kiem tra `requiresApproval`;
- kiem tra approval ton tai;
- validate input bang Zod;
- dung idempotency key;
- log before/after;
- khong dua raw LLM text thang vao MCP tool.

---

## 9. Demo Chinh Trong 20h

Goal demo:

> "Khach hang Nguyen Van A muon vay 2 ty mua nha. Hay danh gia dieu kien, kiem tra tuan thu, chon san pham phu hop va tao ho so neu duoc phep."

Luong demo:

```text
1. Request Classifier
   -> WRITE_ACTION

2. Planner
   -> Credit va Compliance chay song song
   -> Product phu thuoc hai ket qua

3. Credit Specialist
   -> spawn 3 read-only workers
   -> tong hop ket luan + evidence

4. Compliance Specialist
   -> RAG quy dinh
   -> kiem tra AML/KYC
   -> phat hien thieu giay to

5. Product Specialist
   -> de xuat san pham phu hop, khong vi pham compliance

6. Evidence Aggregator
   -> chuan hoa source

7. Reviewer
   -> Credit: CONDITIONAL
   -> Compliance: NEED_MORE_INFORMATION
   -> Product: phu hop
   -> Conflict: chua du dieu kien tao ho so chinh thuc

8. Policy Gate
   -> chan SUBMIT_LOAN_APPLICATION
   -> cho phep CREATE_DOCUMENT_TASK

9. Dashboard
   -> hien ly do, evidence, conflict, allowed/blocked actions

10. User bam Duyet

11. Operations Executor
   -> goi mcp-ops hoac mcp-los
   -> tao task bo sung chung tu

12. Audit
   -> ghi nguoi duyet, tool, payload hash, result
```

Day la demo an toan hon viec "du dieu kien thi submit loan" vi the hien dung tinh than ngan hang: AI khong vuot quyen, nhung van thuc hien action that.

---

## 10. State Model De Xuat

Co the giu `TaskRun`/`TaskStep`, bo sung state cho governance.

```prisma
model TaskRun {
  id             String   @id @default(cuid())
  bankCode       String   @default("SHB")
  employeeId     String?
  goal           String   @db.Text
  riskClass      String
  status         String
  planJson       Json
  reviewJson     Json?
  gateDecision   Json?
  finalAnswer    String?  @db.Text
  createdAt      DateTime @default(now())

  steps          TaskStep[]
  evidence       Evidence[]
  approvals      Approval[]
  executions     ActionExecution[]
}

model TaskStep {
  id              String   @id @default(cuid())
  taskRunId       String
  agentRole       String
  mode            String   @default("direct")
  input           Json
  output          Json?
  status          String
  dependsOn       String[]
  toolCalls       Json[]   @default([])
  evidenceIds     String[]
  retryCount      Int      @default(0)
  startedAt       DateTime?
  finishedAt      DateTime?
}

model Approval {
  id          String   @id @default(cuid())
  taskRunId   String
  actionType  String
  status      String   // pending | approved | rejected
  previewJson Json
  approvedBy  String?
  approvedAt  DateTime?
}

model ActionExecution {
  id             String   @id @default(cuid())
  taskRunId      String
  approvalId     String
  toolName       String
  inputJson      Json
  outputJson     Json?
  idempotencyKey String   @unique
  status         String
  createdAt      DateTime @default(now())
}
```

---

## 11. MCP Suite Dieu Chinh Nho

Giu SHB MCP Suite trong README goc. Chi them metadata policy cho tool.

```ts
type McpToolPolicy = {
  name: string;
  domain: "credit" | "compliance" | "product" | "ops";
  mutates: boolean;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  allowedAgentRoles: string[];
  inputSchemaKey: string;
  outputSchemaKey: string;
  idempotent: boolean;
};
```

Vi du:

```ts
{
  name: "submit_loan_application",
  domain: "credit",
  mutates: true,
  requiresApproval: true,
  riskLevel: "high",
  allowedAgentRoles: ["ops"],
  inputSchemaKey: "SubmitLoanApplicationInput",
  outputSchemaKey: "SubmitLoanApplicationOutput",
  idempotent: true
}
```

Quy tac moi:

- Specialist co the goi read tool.
- Specialist chi de xuat write action.
- Operations Executor moi co quyen thuc thi write tool.
- Moi write tool phai qua Policy Gate va Approval.

---

## 12. Dashboard Moi

Dashboard nen uu tien decision control hon animation.

### 12.1 Case Overview

```text
Goal
Risk classification
Current gate decision
Allowed actions
Blocked actions
```

### 12.2 Execution DAG

```text
Request Classifier
  |
Planner
  |-- Credit
  |-- Compliance
  |-- Product
  |
Evidence Aggregator
  |
Reviewer
  |
Policy Gate
  |
Operations Executor
```

### 12.3 Evidence Panel

```text
Finding
Evidence source
Document version
Effective date
Agent role
Tool/RAG source
```

### 12.4 Conflict Panel

```text
Credit: CONDITIONAL
Compliance: NEED_MORE_INFORMATION
Blocked action: SUBMIT_LOAN_APPLICATION
Allowed action: CREATE_DOCUMENT_TASK
```

### 12.5 Approval Panel

Hien:

- action preview;
- masked payload;
- reason can approval;
- tool se duoc goi;
- risk level;
- approve/reject buttons.

### 12.6 Compare Panel

De dap ung deliverable:

| Tieu chi | Single-agent | Governed Multi-agent |
|---|---|---|
| Planning | 1 cau tra loi truc tiep | Co TaskPlan va DAG |
| Tool routing | De goi sai/mo ho | Tool allowlist theo role |
| Evidence | It hoac khong ro | Moi finding co evidence |
| Safety | De de xuat action vuot quyen | Policy Gate chan action |
| Action | Thuong chi text | Co approval va MCP execution |

---

## 13. Uu Diem

| Uu diem | Gia tri |
|---|---|
| Dung de bai hon | Co planner, specialist, tool, RAG, dashboard, action va comparison |
| An toan hon cho banking | LLM khong duoc tu override policy/action |
| Demo thuyet phuc hon | Giam khao thay duoc ly do allowed/blocked action |
| Trace tot hon | Moi ket luan gan voi evidence, tool call, RAG citation |
| Operations thanh P0 | Co hanh dong that tren he thong mock, khong con optional |
| Van giu stack | Khong doi cong nghe, khong tang rui ro setup |
| Hop voi 20h | Co the mock deterministic flow truoc, gan LLM/tool that sau |
| De pitch production | Co maker-checker, audit, evidence, policy gate, idempotency |

---

## 14. Nhuoc Diem Va Trade-off

| Nhuoc diem | Cach giam rui ro |
|---|---|
| Kien truc nhieu tang hon Planner -> Specialist don gian | Implement mock/static flow truoc, sau do thay tung lop bang logic that |
| Can them state: evidence, review, gate, execution | Co the luu JSON trong `TaskRun` truoc, tach bang sau neu kip |
| Dashboard phuc tap hon | Uu tien 5 panel: DAG, Evidence, Conflict, Approval, Final Answer |
| LLM reviewer co the lam cham | Reviewer co the mock/rule-first trong demo |
| MCP process rieng ton thoi gian | Neu can, giu folder MCP + tool policy, backend adapter goi mock truoc |
| Product/RAG that co the khong kip | Seed 3-5 document/product mau, citation hardcoded co source ro |
| Automation bi day xuong sau | Chap nhan, vi de bai khong bat buoc automation |
| Multi-bank seam khong hien trong demo | Giu `bankCode = "SHB"` trong schema/payload, khong lam UI |

---

## 15. Pham Vi 20h

### P0 - Bat buoc cho demo

1. Frontend demo shell: 1 planner chat + dashboard.
2. Mock TaskRun end-to-end theo luong Governance.
3. DAG: Classifier -> Planner -> Credit/Compliance/Product -> Evidence -> Reviewer -> Policy Gate -> Approval -> Operations.
4. Tool trace mock/real cho `check_loan_eligibility`, `run_aml_check`, `compare_products`, `create_document_task`.
5. Approval button that tren UI.
6. Final answer co citation/evidence.
7. Compare single-agent vs multi-agent.

### P1 - Neu con thoi gian

1. NestJS backend minimal endpoints:
   - `POST /api/task-runs`
   - `GET /api/task-runs/:id`
   - `POST /api/task-runs/:id/approve/:approvalId`
   - `POST /api/compare`
2. WebSocket update step status.
3. MCP server/process mcp-los va mcp-compliance mock.
4. Prisma schema va seed data.

### P2 - Sau khi demo chay on

1. RAG ingest that bang LlamaIndex.TS.
2. pgvector retrieval.
3. Automation mock.
4. Employee/customer portfolio scope-check.
5. Gemini fallback.

### Khong lam trong 20h

- Auth thật.
- RBAC engine.
- Tenant switcher UI.
- Agent Studio.
- Fine-tune model.
- Graph DB/BM25 engine rieng.
- Automation BullMQ neu action flow chua xong.

---

## 16. Thay Doi Nen Ap Dung Vao README Goc

### Quyet dinh #15

Thay:

> DAG kich ban demo co dinh 3 TaskStep.

Bang:

> Demo co expected plan `Credit || Compliance -> Product`. Planner van sinh TaskPlan qua structured output; backend validate theo Agent Catalog. Neu plan khong dat validation hoac lech khoi expected capability graph trong live demo, dung validated fallback plan. Nhu vay vua chung minh planning dong, vua bao dam demo on dinh.

### Phan Operations

Thay:

> Ops neu con thoi gian demo.

Bang:

> Operations Executor la buoc bat buoc trong demo chinh. He thong phai thuc hien it nhat mot side-effect co approval, vi du tao task bo sung ho so hoac tao advisory case.

### Them Section

Them section:

```text
Evidence, Conflict Review & Policy Gate
```

Noi dung:

- specialist output co evidence;
- aggregator chuan hoa nguon;
- reviewer phat hien conflict;
- policy gate quyet dinh allowed/blocked action;
- LLM khong override gate;
- action chi chay tu approved structured plan.

### Sua Cach Mo Ta Worker

Nen viet:

> Specialist co the spawn toi da ba ephemeral analysis workers trong cung domain de thuc hien cac truy van doc lap song song. Worker chi doc, khong co side-effect va khong spawn tiep.

---

## 17. Cau Pitch Moi

> Auco AI khong chi chia viec cho nhieu agent. Moi chuyen gia dua ra ket luan co bang chung; he thong kiem tra xung dot va policy bang mot tang doc lap; moi hanh dong ghi vao he thong ngan hang chi duoc thuc hien tu mot action plan co cau truc, vuot qua policy gate va duoc con nguoi phe duyet.

---

## 18. Ket Luan

Kien truc moi khong doi stack, khong dap lai README goc. No chi them lop governance vao dung cho banking:

```text
Request Classifier
-> Planner
-> Credit + Compliance
-> Product
-> Evidence Aggregator
-> Conflict & Safety Reviewer
-> Deterministic Policy Gate
-> Human Approval
-> Operations Executor
-> SHB MCP Suite
```

Day la phuong an phu hop hon voi de bai, an toan hon trong moi truong ngan hang, va van kha thi trong 20h neu uu tien demo flow truoc, backend/MCP/RAG that hoa sau.
