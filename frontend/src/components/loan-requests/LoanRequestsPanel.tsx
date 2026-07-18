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
  listLoanRequestsApi,
  rejectLoanRequestApi,
  returnLoanRequestApi,
  startLoanAssessmentApi,
  submitLoanApprovalApi,
} from "@/lib/api";
import type {
  LoanAssessmentTag,
  LoanRequest,
  LoanRequestStatus,
} from "@/lib/types/domain";
import { AGENT_LABEL } from "@/lib/labels";
import { useAppStore } from "@/stores/app.store";
import {
  AlertTriangle,
  Banknote,
  Bot,
  CheckCircle2,
  Clock3,
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

function money(value: string | null): string {
  if (!value) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;
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
      ) : null}

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">Lọc theo nhãn:</span>
        <Select
          value={tagFilter}
          onValueChange={(value) =>
            setTagFilter(value as AssessmentTagFilter)
          }
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả nhãn</SelectItem>
            <SelectItem value="untagged">Chưa gắn nhãn</SelectItem>
            {Object.entries(ASSESSMENT_TAG_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleRows.map((row) => (
            <Card key={row.id} className="overflow-hidden">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {row.customer.fullName}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {row.customer.customerNo} · {row.externalRef}
                    </CardDescription>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                {row.assessmentTag ? (
                  <Badge variant="outline">
                    Kết luận NV: {ASSESSMENT_TAG_LABEL[row.assessmentTag]}
                  </Badge>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info
                    label="Số tiền yêu cầu"
                    value={money(row.requestedAmountVnd)}
                  />
                  <Info
                    label="Kỳ hạn"
                    value={`${row.requestedTermMonths} tháng`}
                  />
                  <Info label="Mục đích vay" value={row.loanPurpose} />
                  <Info
                    label="Tài sản bảo đảm"
                    value={row.collateralType ?? "Tín chấp / chưa khai báo"}
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
                      Vượt hạn mức chi nhánh{" "}
                      {money(row.branchApprovalLimitVnd)}. Nếu phê duyệt sẽ
                      chuyển trạng thái escalated (cấp trên).
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
                      {row.decidedBy
                        ? ` · ${row.decidedBy.displayName}`
                        : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-line">
                      {row.decisionNote}
                    </p>
                  </div>
                ) : null}

                {row.assessmentTaskRun ? (
                  <AssessmentSummary
                    request={row}
                    onOpen={() => openAssessmentInAi(row)}
                  />
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
  onAssessmentTagChange: (value: LoanAssessmentTag) => void;
  onStaffNoteChange: (value: string) => void;
  onStartAssessment: () => void;
  onOpenAssessment: () => void;
  onSubmit: () => void;
}) {
  if (row.status === "assigned" || row.status === "failed") {
    return (
      <Button className="w-full" onClick={onStartAssessment} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        Đánh giá bằng Trợ lý AI
      </Button>
    );
  }

  if (row.status === "assessing") {
    return (
      <Button className="w-full" variant="outline" onClick={onOpenAssessment}>
        <Loader2 className="animate-spin" />
        Xem AI đang đánh giá
      </Button>
    );
  }

  if (row.status === "advised" || row.status === "needs_info") {
    const canResubmit =
      row.status === "advised" || Boolean(row.assessmentTaskRun);
    return (
      <>
        {row.status === "needs_info" ? (
          <p className="text-muted-foreground text-xs">
            Giám đốc yêu cầu bổ sung. Chạy lại đánh giá nếu cần, rồi trình
            duyệt lại.
          </p>
        ) : null}
        {canResubmit ? (
          <>
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
                  {Object.entries(ASSESSMENT_TAG_LABEL).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={staffNote}
              onChange={(e) => onStaffNoteChange(e.target.value)}
              placeholder="Giải thích căn cứ kết luận cho giám đốc…"
              rows={2}
            />
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenAssessment} disabled={busy}>
            <Bot />
            Mở kết quả trong Trợ lý AI
          </Button>
          {row.status === "needs_info" ? (
            <Button
              variant="outline"
              onClick={onStartAssessment}
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Chạy lại bằng AI
            </Button>
          ) : null}
          {canResubmit ? (
            <Button
              className="flex-1"
              onClick={onSubmit}
              disabled={busy || !assessmentTag}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              Trình duyệt
            </Button>
          ) : null}
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

function AssessmentSummary({
  request,
  onOpen,
}: {
  request: LoanRequest;
  onOpen: () => void;
}) {
  const run = request.assessmentTaskRun;
  if (!run) return null;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Gợi ý AI (không phải quyết định)</p>
        <Button variant="ghost" size="sm" className="h-7" onClick={onOpen}>
          Mở trong Trợ lý AI
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {run.steps.map((step) => (
          <Badge key={step.id} variant="outline">
            {AGENT_LABEL[step.agentRole]} · {step.status}
          </Badge>
        ))}
      </div>
      {run.finalAnswer ? (
        <p className="text-muted-foreground line-clamp-5 whitespace-pre-line text-sm">
          {run.finalAnswer}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Hệ thống đang thu thập CIC, AML, dữ liệu TSĐB và chính sách liên quan.
        </p>
      )}
    </div>
  );
}
