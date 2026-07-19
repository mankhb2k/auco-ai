"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  approveLoanRequestApi,
  assignLoanRequestApi,
  listAuditEventsApi,
  listLoanRequestsApi,
  rejectLoanRequestApi,
  returnLoanRequestApi,
  revealCustomerPiiApi,
  startLoanAssessmentApi,
  submitLoanApprovalApi,
  type RevealedCustomerPii,
} from "@/lib/api";
import type {
  AuditEvent,
  LoanAssessmentTag,
  LoanRequest,
  LoanRequestStatus,
} from "@/lib/types/domain";
import { useAppStore } from "@/stores/app.store";
import {
  AlertTriangle,
  Banknote,
  Bot,
  CheckCircle2,
  Clock3,
  Eye,
  History,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Undo2,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const STATUS_LABEL: Record<LoanRequestStatus, string> = {
  unassigned: "Chưa phân bổ",
  assigned: "Đã phân bổ",
  assessing: "Đang đánh giá",
  advised: "Đã có gợi ý",
  pending_approval: "Chờ duyệt",
  approved: "Đã phê duyệt",
  rejected: "Đã từ chối",
  escalated: "Chuyển cấp trên",
  needs_info: "Cần bổ sung",
  failed: "Đánh giá lỗi",
};

const ASSESSMENT_TAG_LABEL: Record<LoanAssessmentTag, string> = {
  recommend_approve: "Đề xuất phê duyệt",
  manual_review: "Cần rà soát",
  needs_documents: "Cần bổ sung hồ sơ",
  recommend_reject: "Đề xuất từ chối",
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  "loan_request.intake": "Tiếp nhận hồ sơ",
  "loan_request.assign": "Phân bổ cho nhân viên",
  "loan_request.assessment.start": "Bắt đầu đánh giá AI",
  "loan_request.assessment.tag": "Gắn nhãn kết luận",
  "loan_request.submit": "Trình giám đốc",
  "loan_request.approve": "Phê duyệt",
  "loan_request.escalate": "Chuyển cấp trên (vượt hạn mức)",
  "loan_request.reject": "Từ chối",
  "loan_request.return": "Trả bổ sung hồ sơ",
  "loan_request.pii_reveal": "Xem dữ liệu nhạy cảm (CMND/số dư)",
  "task_run.create": "Tạo phiên đánh giá",
};

function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

type AssessmentTagFilter = "all" | "untagged" | LoanAssessmentTag;

type QueueFilter =
  | "all"
  | "unassigned"
  | "in_progress"
  | "pending_approval"
  | "decided";

const MANAGER_FILTERS: Array<{ id: QueueFilter; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "unassigned", label: "Chưa phân bổ" },
  { id: "in_progress", label: "Đang xử lý" },
  { id: "pending_approval", label: "Chờ duyệt" },
  { id: "decided", label: "Đã quyết định" },
];

const STAFF_TAG_FILTERS: Array<{ id: AssessmentTagFilter; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "untagged", label: "Chưa gắn nhãn" },
  ...Object.entries(ASSESSMENT_TAG_LABEL).map(([id, label]) => ({
    id: id as LoanAssessmentTag,
    label,
  })),
];

function money(value: string | null): string {
  if (!value) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;
}

function dateTime(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function assessmentFinishedAt(row: LoanRequest): string | null {
  const timestamps =
    row.assessmentTaskRun?.steps
      .map((step) => step.finishedAt)
      .filter((value): value is string => Boolean(value)) ?? [];
  if (timestamps.length === 0) return null;
  return timestamps.reduce((latest, current) =>
    new Date(current) > new Date(latest) ? current : latest,
  );
}

function assessmentPromptPreview(row: LoanRequest): string {
  return [
    `Đánh giá yêu cầu vay của ${row.customer.fullName} (${row.customer.customerNo}).`,
    `Số tiền ${row.requestedAmountVnd} VND, kỳ hạn ${row.requestedTermMonths} tháng, mục đích: ${row.loanPurpose}.`,
    `TSĐB khai báo: ${row.collateralType ?? "không có"}; giá trị ước tính: ${row.estimatedCollateralVnd ?? "chưa có"} VND.`,
    "Kiểm tra CIC/dư nợ, khả năng trả nợ, AML/tuân thủ, hồ sơ TSĐB/LTV và đề xuất sản phẩm phù hợp.",
    "Chỉ đưa gợi ý cho nhân viên; không tạo hồ sơ, hợp đồng hoặc giải ngân.",
  ].join(" ");
}

function matchesFilter(row: LoanRequest, filter: QueueFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unassigned") return row.status === "unassigned";
  if (filter === "pending_approval") return row.status === "pending_approval";
  if (filter === "decided") {
    return ["approved", "rejected", "escalated"].includes(row.status);
  }
  return ["assigned", "assessing", "advised", "needs_info", "failed"].includes(
    row.status,
  );
}

export function LoanRequestsPanel() {
  const employeeId = useAppStore((s) => s.employeeId);
  const employees = useAppStore((s) => s.employees);
  const actor = employees.find((employee) => employee.id === employeeId);
  const setAskAiOpen = useAppStore((s) => s.setAskAiOpen);
  const openLoanAssessmentInAi = useAppStore(
    (s) => s.openLoanAssessmentInAi,
  );
  const isManager = actor?.accessLayer === "manager";
  const creditOfficers = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.role === "credit_officer" &&
          (!actor?.branchCode || employee.branchCode === actor.branchCode),
      ),
    [actor?.branchCode, employees],
  );

  const [rows, setRows] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [staffNotes, setStaffNotes] = useState<Record<string, string>>({});
  const [assessmentTags, setAssessmentTags] = useState<
    Record<string, LoanAssessmentTag>
  >({});
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>(
    {},
  );
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [tagFilter, setTagFilter] = useState<AssessmentTagFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealedPii, setRevealedPii] = useState<
    Record<string, RevealedCustomerPii>
  >({});
  const [piiBusyId, setPiiBusyId] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        setRows(await listLoanRequestsApi(employeeId));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Không tải được hồ sơ vay",
        );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [employeeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load(true);
    window.addEventListener("loan-request-updated", refresh);
    return () => window.removeEventListener("loan-request-updated", refresh);
  }, [load]);

  useEffect(() => {
    if (!rows.some((row) => row.status === "assessing")) return;
    const timer = setInterval(() => void load(true), 2000);
    return () => clearInterval(timer);
  }, [load, rows]);

  useEffect(() => {
    if (!selectedId) {
      setAuditEvents([]);
      return;
    }
    let cancelled = false;
    setAuditLoading(true);
    listAuditEventsApi({
      employeeId,
      resource: `LoanRequest:${selectedId}`,
      limit: 50,
    })
      .then((events) => {
        if (!cancelled) setAuditEvents(events);
      })
      .catch(() => {
        if (!cancelled) setAuditEvents([]);
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, selectedId]);

  async function revealPii(row: LoanRequest) {
    setPiiBusyId(row.id);
    try {
      const pii = await revealCustomerPiiApi({ id: row.id, employeeId });
      setRevealedPii((current) => ({ ...current, [row.id]: pii }));
      toast.message("Đã ghi log truy cập dữ liệu nhạy cảm của khách hàng");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể hiện dữ liệu",
      );
    } finally {
      setPiiBusyId(null);
    }
  }

  const visibleRows = useMemo(() => {
    const byStatus = isManager
      ? rows.filter((row) => matchesFilter(row, filter))
      : rows;
    if (tagFilter === "all") return byStatus;
    if (tagFilter === "untagged") {
      return byStatus.filter((row) => !row.assessmentTag);
    }
    return byStatus.filter((row) => row.assessmentTag === tagFilter);
  }, [filter, isManager, rows, tagFilter]);

  function patchRow(updated: LoanRequest) {
    setRows((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  async function assign(row: LoanRequest) {
    const assigneeId = assignees[row.id] ?? row.assignedTo?.id;
    if (!assigneeId) {
      toast.error("Chọn nhân viên tín dụng trước khi phân bổ");
      return;
    }
    setBusyId(row.id);
    try {
      patchRow(
        await assignLoanRequestApi({
          id: row.id,
          employeeId,
          assigneeId,
        }),
      );
      toast.success("Đã phân bổ hồ sơ");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Phân bổ thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function startAssessment(row: LoanRequest) {
    setAskAiOpen(true);
    setBusyId(row.id);
    try {
      const updated = await startLoanAssessmentApi(row.id, employeeId);
      patchRow(updated);
      openAssessmentInAi(updated);
      toast.success(
        "Đã gửi yêu cầu tự động: Credit ‖ Legal ‖ Collateral → Product",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể chạy đánh giá",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function submitApproval(row: LoanRequest) {
    const staffNote = (staffNotes[row.id] ?? "").trim();
    const assessmentTag = assessmentTags[row.id] ?? row.assessmentTag;
    if (!assessmentTag) {
      toast.error("Chọn nhãn kết luận thẩm định trước khi trình duyệt");
      return;
    }
    if (staffNote.length < 5) {
      toast.error("Nhập ý kiến trình duyệt (tối thiểu 5 ký tự)");
      return;
    }
    setBusyId(row.id);
    try {
      patchRow(
        await submitLoanApprovalApi({
          id: row.id,
          employeeId,
          assessmentTag,
          staffNote,
        }),
      );
      toast.success("Đã trình duyệt cho giám đốc");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Trình duyệt thất bại",
      );
    } finally {
      setBusyId(null);
    }
  }

  function openAssessmentInAi(row: LoanRequest) {
    if (!row.assessmentTaskRun) {
      toast.error("Hồ sơ chưa có TaskRun đánh giá");
      return;
    }
    openLoanAssessmentInAi({
      loanRequestId: row.id,
      externalRef: row.externalRef,
      customerName: row.customer.fullName,
      prompt: row.assessmentTaskRun.goal || assessmentPromptPreview(row),
      run: row.assessmentTaskRun,
    });
  }

  async function decide(
    row: LoanRequest,
    action: "approve" | "reject" | "return",
  ) {
    const decisionNote = (decisionNotes[row.id] ?? "").trim();
    if (action !== "approve" && decisionNote.length < 5) {
      toast.error("Ghi chú bắt buộc khi từ chối hoặc trả bổ sung");
      return;
    }
    setBusyId(row.id);
    try {
      const updated =
        action === "approve"
          ? await approveLoanRequestApi({
              id: row.id,
              employeeId,
              decisionNote: decisionNote || undefined,
            })
          : action === "reject"
            ? await rejectLoanRequestApi({
                id: row.id,
                employeeId,
                decisionNote,
              })
            : await returnLoanRequestApi({
                id: row.id,
                employeeId,
                decisionNote,
              });
      patchRow(updated);
      toast.success(
        action === "approve"
          ? updated.status === "escalated"
            ? "Vượt hạn mức — đã chuyển cấp trên"
            : "Đã phê duyệt"
          : action === "reject"
            ? "Đã từ chối"
            : "Đã trả hồ sơ để bổ sung",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Quyết định thất bại",
      );
    } finally {
      setBusyId(null);
    }
  }

  const selectedRow = selectedId
    ? rows.find((row) => row.id === selectedId) ?? null
    : null;

  if (selectedRow) {
    const row = selectedRow;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedId(null)}
          >
            <Undo2 />
            Danh sách hồ sơ
          </Button>
          <StatusBadge status={row.status} />
          {row.assessmentTag ? (
            <Badge variant="outline">
              Kết luận NV: {ASSESSMENT_TAG_LABEL[row.assessmentTag]}
            </Badge>
          ) : null}
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {row.customer.fullName}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {row.customer.customerNo} · {row.externalRef}
          </p>
        </div>

        <div className="bg-muted/30 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-xs">
          <span className="text-muted-foreground">CMND/CCCD:</span>
          <span className="font-mono">
            {revealedPii[row.id]?.nationalId ??
              row.customer.nationalIdMasked ??
              "—"}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Số dư khả dụng:</span>
          <span className="font-mono">
            {revealedPii[row.id]
              ? money(String(revealedPii[row.id].availableBalanceVnd ?? ""))
              : row.customer.availableBalanceMasked ?? "—"}
          </span>
          {!revealedPii[row.id] ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-6 px-2 text-[11px]"
              disabled={piiBusyId === row.id}
              onClick={() => void revealPii(row)}
            >
              {piiBusyId === row.id ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Eye />
              )}
              Hiện đầy đủ
            </Button>
          ) : (
            <span className="text-muted-foreground ml-auto text-[11px]">
              Đã ghi log truy cập
            </span>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Thông tin khoản vay</CardTitle>
              {!isManager &&
              ["assigned", "failed", "advised", "needs_info"].includes(
                row.status,
              ) ? (
                <Select
                  value={assessmentTags[row.id] ?? row.assessmentTag ?? ""}
                  onValueChange={(value) =>
                    setAssessmentTags((current) => ({
                      ...current,
                      [row.id]: value as LoanAssessmentTag,
                    }))
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Chọn nhãn kết luận thẩm định" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ASSESSMENT_TAG_LABEL).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info
                label="Số tiền yêu cầu"
                value={money(row.requestedAmountVnd)}
              />
              <Info label="Kỳ hạn" value={`${row.requestedTermMonths} tháng`} />
              <Info label="Mục đích vay" value={row.loanPurpose} />
              <Info
                label="Tài sản bảo đảm"
                value={row.collateralType ?? "Tín chấp / chưa khai báo"}
              />
              <Info
                label="Thu nhập khai báo"
                value={money(row.declaredIncomeVnd)}
              />
              <Info
                label="Giá trị TSĐB ước tính"
                value={money(row.estimatedCollateralVnd)}
              />
            </div>

            <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
              <Banknote className="text-muted-foreground size-4" />
              <span>Nguồn: App ngân hàng</span>
              <span className="text-muted-foreground">·</span>
              <span>{row.customer.branchCode ?? "Chưa rõ chi nhánh"}</span>
              {row.assignedTo ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <UserRoundCheck className="size-4" />
                  <span>{row.assignedTo.displayName}</span>
                </>
              ) : null}
            </div>

            {row.exceedsBranchLimit ? (
              <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Vượt hạn mức chi nhánh {money(row.branchApprovalLimitVnd)}.
                  Nếu phê duyệt sẽ chuyển trạng thái escalated (cấp trên).
                </span>
              </div>
            ) : null}

            {row.staffNote ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-muted-foreground text-xs">
                  Ý kiến trình duyệt
                </p>
                <p className="mt-1 whitespace-pre-line">{row.staffNote}</p>
              </div>
            ) : null}

            {row.decisionNote ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-muted-foreground text-xs">
                  Quyết định
                  {row.decidedBy ? ` · ${row.decidedBy.displayName}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-line">{row.decisionNote}</p>
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="bg-muted/20 flex flex-col items-stretch gap-2 border-t py-3">
            {isManager ? (
              <ManagerActions
                row={row}
                busy={busyId === row.id}
                creditOfficers={creditOfficers}
                assignee={assignees[row.id] ?? row.assignedTo?.id ?? ""}
                decisionNote={decisionNotes[row.id] ?? ""}
                onAssigneeChange={(value) =>
                  setAssignees((current) => ({
                    ...current,
                    [row.id]: value,
                  }))
                }
                onDecisionNoteChange={(value) =>
                  setDecisionNotes((current) => ({
                    ...current,
                    [row.id]: value,
                  }))
                }
                onAssign={() => void assign(row)}
                onApprove={() => void decide(row, "approve")}
                onReject={() => void decide(row, "reject")}
                onReturn={() => void decide(row, "return")}
              />
            ) : (
              <StaffActions
                row={row}
                busy={busyId === row.id}
                staffNote={staffNotes[row.id] ?? ""}
                assessmentTag={
                  assessmentTags[row.id] ?? row.assessmentTag ?? ""
                }
                showTagSelect={false}
                onAssessmentTagChange={(value) =>
                  setAssessmentTags((current) => ({
                    ...current,
                    [row.id]: value,
                  }))
                }
                onStaffNoteChange={(value) =>
                  setStaffNotes((current) => ({
                    ...current,
                    [row.id]: value,
                  }))
                }
                onStartAssessment={() => void startAssessment(row)}
                onOpenAssessment={() => openAssessmentInAi(row)}
                onSubmit={() => void submitApproval(row)}
              />
            )}
          </CardFooter>
        </Card>

        {row.assessmentTaskRun?.status === "done" &&
        row.assessmentTaskRun.finalAnswer ? (
          <Card>
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bot className="size-4" />
                    Kết quả đánh giá AI
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Lưu theo hồ sơ {row.externalRef}
                  </CardDescription>
                </div>
                <div className="text-muted-foreground space-y-1 text-right text-xs">
                  <p>Bắt đầu: {dateTime(row.assessmentStartedAt)}</p>
                  <p>Hoàn tất: {dateTime(assessmentFinishedAt(row))}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm leading-6">
                {row.assessmentTaskRun.finalAnswer}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" />
              Lịch sử xử lý
            </CardTitle>
            <CardDescription>
              Toàn bộ hành động đã ghi audit trên hồ sơ {row.externalRef}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Đang tải lịch sử…
              </div>
            ) : auditEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Chưa có sự kiện nào được ghi nhận.
              </p>
            ) : (
              <ol className="space-y-3">
                {auditEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0"
                  >
                    <div>
                      <span className="font-medium">
                        {auditActionLabel(event.action)}
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {employees.find((e) => e.id === event.actorId)
                          ?.displayName ?? event.actorId}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {dateTime(event.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {isManager ? "Hàng đợi yêu cầu vay" : "Hồ sơ vay của tôi"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {isManager
              ? "Phân bổ hồ sơ · duyệt trong hạn mức chi nhánh 5 tỷ · AI chỉ là gợi ý."
              : "Đánh giá AI → chọn nhãn kết luận → ghi ý kiến → trình giám đốc duyệt."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Làm mới
        </Button>
      </div>

      {isManager ? (
        <div className="flex flex-wrap gap-2">
          {MANAGER_FILTERS.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={filter === item.id ? "default" : "outline"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              {item.id !== "all" ? (
                <span className="text-muted-foreground ml-1 text-xs">
                  {
                    rows.filter((row) => matchesFilter(row, item.id)).length
                  }
                </span>
              ) : null}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {STAFF_TAG_FILTERS.map((item) => {
            const count =
              item.id === "all"
                ? rows.length
                : item.id === "untagged"
                  ? rows.filter((row) => !row.assessmentTag).length
                  : rows.filter((row) => row.assessmentTag === item.id)
                      .length;
            return (
              <Button
                key={item.id}
                size="sm"
                variant={tagFilter === item.id ? "default" : "outline"}
                onClick={() => setTagFilter(item.id)}
              >
                {item.label}
                {item.id !== "all" ? (
                  <span className="text-muted-foreground ml-1 text-xs">
                    {count}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground flex min-h-48 items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Đang tải hồ sơ…
        </div>
      ) : visibleRows.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex min-h-48 items-center justify-center text-sm">
            {isManager
              ? "Không có hồ sơ trong bộ lọc này."
              : "Bạn chưa được phân bổ hồ sơ nào."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {visibleRows.map((row) => (
            <Card
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(row.id);
                }
              }}
              className="hover:border-foreground/30 hover:bg-muted/40 focus-visible:ring-ring cursor-pointer gap-3 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <CardHeader className="gap-1 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="min-w-0 truncate text-sm">
                    {row.customer.fullName}
                  </CardTitle>
                  <StatusBadge status={row.status} />
                </div>
                <CardDescription className="text-xs">
                  {row.externalRef} · {row.customer.customerNo}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-base font-semibold">
                    {money(row.requestedAmountVnd)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {row.requestedTermMonths} tháng
                  </p>
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {row.loanPurpose}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {row.assessmentTag ? (
                    <Badge variant="outline" className="text-[10px]">
                      {ASSESSMENT_TAG_LABEL[row.assessmentTag]}
                    </Badge>
                  ) : null}
                  {row.exceedsBranchLimit ? (
                    <Badge variant="destructive" className="text-[10px]">
                      <AlertTriangle />
                      Vượt hạn mức
                    </Badge>
                  ) : null}
                  {row.status === "assessing" ? (
                    <Badge variant="secondary" className="text-[10px]">
                      <Loader2 className="animate-spin" />
                      AI đang chạy
                    </Badge>
                  ) : null}
                </div>
                {row.assignedTo ? (
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <UserRoundCheck className="size-3.5" />
                    {row.assignedTo.displayName}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Chưa phân bổ
                  </p>
                )}
              </CardContent>
              {!isManager ? (
                <CardFooter
                  className="flex flex-col gap-2 border-t bg-transparent px-4 py-3"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {row.status === "assessing" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openAssessmentInAi(row)}
                    >
                      <Loader2 className="animate-spin" />
                      Xem AI đang đánh giá
                    </Button>
                  ) : (
                    <div className="flex w-full gap-2">
                      {row.assessmentTaskRun ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-w-0 flex-1"
                          onClick={() => openAssessmentInAi(row)}
                        >
                          <Bot />
                          Kết quả AI
                        </Button>
                      ) : null}
                      {row.status === "assigned" ||
                      row.status === "failed" ||
                      row.status === "needs_info" ||
                      row.status === "advised" ? (
                        <Button
                          size="sm"
                          className="min-w-0 flex-1"
                          disabled={busyId === row.id}
                          onClick={() => void startAssessment(row)}
                        >
                          {busyId === row.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <ShieldCheck />
                          )}
                          {row.assessmentTaskRun
                            ? "Đánh giá lại"
                            : "Đánh giá AI"}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </CardFooter>
              ) : null}
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}

function ManagerActions({
  row,
  busy,
  creditOfficers,
  assignee,
  decisionNote,
  onAssigneeChange,
  onDecisionNoteChange,
  onAssign,
  onApprove,
  onReject,
  onReturn,
}: {
  row: LoanRequest;
  busy: boolean;
  creditOfficers: Array<{ id: string; displayName: string }>;
  assignee: string;
  decisionNote: string;
  onAssigneeChange: (value: string) => void;
  onDecisionNoteChange: (value: string) => void;
  onAssign: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReturn: () => void;
}) {
  if (row.status === "pending_approval") {
    return (
      <>
        <Textarea
          value={decisionNote}
          onChange={(e) => onDecisionNoteChange(e.target.value)}
          placeholder="Ghi chú quyết định (bắt buộc khi từ chối / trả bổ sung)"
          rows={2}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={onApprove} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {row.exceedsBranchLimit ? "Chuyển cấp trên" : "Phê duyệt"}
          </Button>
          <Button variant="destructive" onClick={onReject} disabled={busy}>
            <XCircle />
            Từ chối
          </Button>
          <Button variant="outline" onClick={onReturn} disabled={busy}>
            <Undo2 />
            Trả bổ sung
          </Button>
        </div>
      </>
    );
  }

  if (
    row.status === "unassigned" ||
    (row.status === "assigned" && !row.assessmentTaskRun)
  ) {
    return (
      <div className="flex flex-wrap gap-2">
        <Select
          value={assignee}
          onValueChange={onAssigneeChange}
          disabled={Boolean(row.assessmentTaskRun)}
        >
          <SelectTrigger className="min-w-52 flex-1">
            <SelectValue placeholder="Chọn nhân viên tín dụng" />
          </SelectTrigger>
          <SelectContent>
            {creditOfficers.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={onAssign}
          disabled={busy || Boolean(row.assessmentTaskRun)}
        >
          {busy ? <Loader2 className="animate-spin" /> : <UserRoundCheck />}
          Phân bổ
        </Button>
      </div>
    );
  }

  return (
    <p className="text-muted-foreground text-xs">
      Hồ sơ đang ở trạng thái «{STATUS_LABEL[row.status]}» — không có hành động
      phân bổ/duyệt tại bước này.
    </p>
  );
}

function StaffActions({
  row,
  busy,
  staffNote,
  assessmentTag,
  showTagSelect = true,
  onAssessmentTagChange,
  onStaffNoteChange,
  onStartAssessment,
  onOpenAssessment,
  onSubmit,
}: {
  row: LoanRequest;
  busy: boolean;
  staffNote: string;
  assessmentTag: LoanAssessmentTag | "";
  showTagSelect?: boolean;
  onAssessmentTagChange: (value: LoanAssessmentTag) => void;
  onStaffNoteChange: (value: string) => void;
  onStartAssessment: () => void;
  onOpenAssessment: () => void;
  onSubmit: () => void;
}) {
  const canManualConclude =
    row.status === "assigned" ||
    row.status === "failed" ||
    row.status === "advised" ||
    row.status === "needs_info";

  if (row.status === "assessing") {
    return (
      <Button className="w-full" variant="outline" onClick={onOpenAssessment}>
        <Loader2 className="animate-spin" />
        Xem AI đang đánh giá
      </Button>
    );
  }

  if (canManualConclude) {
    return (
      <>
        {row.status === "needs_info" ? (
          <p className="text-muted-foreground text-xs">
            Giám đốc yêu cầu bổ sung. Có thể chạy lại AI hoặc tự gắn nhãn rồi
            trình duyệt lại.
          </p>
        ) : null}
        {row.status === "failed" ? (
          <p className="text-muted-foreground text-xs">
            Đánh giá AI lỗi — có thể chạy lại hoặc tự kết luận thủ công.
          </p>
        ) : null}

        {showTagSelect ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              Kết luận thẩm định của nhân viên
            </p>
            <Select
              value={assessmentTag}
              onValueChange={(value) =>
                onAssessmentTagChange(value as LoanAssessmentTag)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn nhãn trước khi trình duyệt" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ASSESSMENT_TAG_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <Textarea
          value={staffNote}
          onChange={(e) => onStaffNoteChange(e.target.value)}
          placeholder="Giải thích căn cứ kết luận cho giám đốc…"
          rows={2}
        />

        <div className="flex flex-wrap gap-2">
          {row.assessmentTaskRun ? (
            <Button variant="outline" onClick={onOpenAssessment} disabled={busy}>
              <Bot />
              Mở kết quả AI
            </Button>
          ) : null}
          {row.status === "assigned" ||
          row.status === "failed" ||
          row.status === "needs_info" ||
          row.status === "advised" ? (
            <Button
              variant="outline"
              onClick={onStartAssessment}
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {row.assessmentTaskRun
                ? "Đánh giá lại bằng AI"
                : "Đánh giá bằng Trợ lý AI"}
            </Button>
          ) : null}
          <Button
            className="flex-1"
            onClick={onSubmit}
            disabled={busy || !assessmentTag}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Send />}
            Trình hồ sơ
          </Button>
        </div>
      </>
    );
  }

  if (row.status === "pending_approval") {
    return (
      <p className="text-muted-foreground text-center text-xs">
        Đã trình duyệt — chờ giám đốc quyết định.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-center text-xs">
      {STATUS_LABEL[row.status]}
      {row.decisionNote ? ` · ${row.decisionNote}` : ""}
    </p>
  );
}

function StatusBadge({ status }: { status: LoanRequestStatus }) {
  const icon =
    status === "approved" || status === "advised" ? (
      <CheckCircle2 />
    ) : status === "rejected" ||
      status === "failed" ||
      status === "needs_info" ||
      status === "escalated" ? (
      <AlertTriangle />
    ) : (
      <Clock3 />
    );
  const variant =
    status === "rejected" || status === "failed"
      ? "destructive"
      : status === "approved"
        ? "default"
        : "secondary";
  return (
    <Badge variant={variant}>
      {icon}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 line-clamp-2 font-medium">{value}</p>
    </div>
  );
}
