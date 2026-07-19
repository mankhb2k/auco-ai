"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AgentCoordinationProgress } from "@/components/chat/AgentCoordinationProgress";
import {
  createTaskRunApi,
  getTaskRunApi,
  isLiveApi,
  setLoanAssessmentTagApi,
  submitLoanApprovalApi,
} from "@/lib/api";
import type { LoanAssessmentTag, TaskRun } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app.store";
import {
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  run?: TaskRun;
  loanLabel?: string;
  loanRequestId?: string;
  appliedAssessmentTag?: LoanAssessmentTag;
  submitted?: boolean;
};

const ASSESSMENT_TAG_LABEL: Record<LoanAssessmentTag, string> = {
  recommend_approve: "Đề xuất phê duyệt",
  manual_review: "Cần rà soát",
  needs_documents: "Cần bổ sung hồ sơ",
  recommend_reject: "Đề xuất từ chối",
};

/**
 * Nhãn đề xuất ưu tiên lấy từ policy gate deterministic của backend
 * (`TaskRun.suggestedAssessmentTag` — LTV/AML rule cứng, xem
 * backend/src/planning/service/policy-gate.ts). Chỉ soi chữ trong
 * finalAnswer khi backend chưa có field này (run cũ trước migration).
 */
function inferAssessmentTag(run: TaskRun): LoanAssessmentTag {
  if (run.suggestedAssessmentTag) return run.suggestedAssessmentTag;

  const answer = run.finalAnswer?.toLowerCase() ?? "";
  if (answer.includes("do_not_proceed")) return "recommend_reject";
  if (answer.includes("insufficient_data")) return "needs_documents";
  if (answer.includes("manual_review")) return "manual_review";
  if (answer.includes("proceed_with_conditions")) return "recommend_approve";

  const credit = run.steps.find((step) => step.agentRole === "credit")?.output;
  const legal = run.steps.find((step) => step.agentRole === "legal")?.output;
  const collateral = run.steps.find(
    (step) => step.agentRole === "collateral",
  )?.output;
  if (credit?.eligible === false) return "recommend_reject";
  if (collateral?.status === "needs_info") return "needs_documents";
  if (legal?.amlStatus && legal.amlStatus !== "clear") return "manual_review";
  return "recommend_approve";
}

const SUGGESTIONS: Array<{ title: string; subtitle: string; goal: string }> = [
  {
    title: "Đánh giá khoản vay mua nhà",
    subtitle: "KH Nguyễn Văn An · 2 tỷ",
    goal: "Khách hàng Nguyễn Văn An (SHB-KH-1001) muốn vay 2 tỷ mua nhà, kiểm tra đủ điều kiện tín dụng và AML không, sản phẩm nào phù hợp?",
  },
  {
    title: "Hạn mức doanh nghiệp",
    subtitle: "SHB Mekong · 50 tỷ · TT39",
    goal: "Phân tích hồ sơ vay của Công ty SHB Mekong (SHB-KH-1002), khoản vay 50 tỷ mở rộng nhà máy. Hạn mức tối đa theo quy định hiện tại là bao nhiêu, có mâu thuẫn Thông tư 39 không?",
  },
  {
    title: "Cảnh báo ngoại tệ",
    subtitle: "KH Trần Thị Bình · FX/USD",
    goal: "Khách hàng Trần Thị Bình (SHB-KH-1003) muốn vay và chuyển đổi khoản lớn sang USD. Kiểm tra rủi ro tín dụng và AML trước khi duyệt.",
  },
  {
    title: "Quy định LTV hiện hành",
    subtitle: "Nhà xưởng · nội bộ vs TT39",
    goal: "LTV tối đa với nhà xưởng theo quy định nội bộ SHB hiện hành là bao nhiêu, khác gì Thông tư 39?",
  },
  {
    title: "Tra cứu văn bản Hội sở",
    subtitle: "Vay mua nhà 2026 · lãi suất",
    goal: "Theo văn bản chuẩn hóa của Hội sở, điều kiện và lãi suất vay mua nhà SHB 2026 là gì? Trích dẫn nguồn.",
  },
];

let msgSeq = 0;
function nextId() {
  msgSeq += 1;
  return `aim-${Date.now()}-${msgSeq}`;
}

/** Badge trích dẫn kiểu Perplexity: pill nhỏ, chữ mono, icon nguồn. */
function CitationBadge({ label }: { label: string }) {
  const compact = label.replace(/\s*\[(active|draft|superseded)\]\s*$/i, "");
  return (
    <span
      title={label}
      className="bg-muted/70 text-muted-foreground hover:bg-muted mx-0.5 inline-flex max-w-56 cursor-default items-center gap-1 rounded-md border px-1.5 py-px align-middle font-mono text-[10px] leading-5 whitespace-nowrap transition-colors"
    >
      <BookOpen className="size-3 shrink-0" />
      <span className="truncate">{compact}</span>
    </span>
  );
}

const INLINE_CITATION_RE = /\(\s*Trích dẫn:\s*([^)\n]+)\)/g;
const CITATION_SECTION_RE = /^\**\s*(?:\d+\.\s*)?Trích dẫn( quy định)?:?\**\s*$/i;
const BULLET_RE = /^\s*(?:[•\-*]|\d+\.)\s+(.*)$/;

/**
 * Render câu trả lời: biến "(Trích dẫn: X)" thành badge inline,
 * và mục "Trích dẫn quy định:" thành hàng badge.
 */
function renderAnswer(content: string): ReactNode {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let citationList: string[] = [];
  let inCitationSection = false;

  const flushCitations = (key: string) => {
    if (citationList.length === 0) return;
    blocks.push(
      <span key={key} className="flex flex-wrap gap-1 py-0.5">
        {citationList.map((c, i) => (
          <CitationBadge key={`${key}-${i}`} label={c} />
        ))}
      </span>,
    );
    citationList = [];
  };

  lines.forEach((line, index) => {
    if (CITATION_SECTION_RE.test(line.trim())) {
      inCitationSection = true;
      return;
    }
    if (inCitationSection) {
      const bullet = line.match(BULLET_RE);
      if (bullet) {
        citationList.push(bullet[1].trim());
        return;
      }
      if (line.trim() === "") {
        if (citationList.length > 0) {
          flushCitations(`cites-${index}`);
          inCitationSection = false;
        }
        return;
      }
      flushCitations(`cites-${index}`);
      inCitationSection = false;
    }

    // Inline "(Trích dẫn: X)" → badge
    const parts: ReactNode[] = [];
    let cursor = 0;
    for (const match of line.matchAll(INLINE_CITATION_RE)) {
      const start = match.index ?? 0;
      if (start > cursor) parts.push(line.slice(cursor, start));
      parts.push(
        <CitationBadge key={`${index}-${start}`} label={match[1].trim()} />,
      );
      cursor = start + match[0].length;
    }
    if (cursor < line.length) parts.push(line.slice(cursor));

    blocks.push(
      <span key={`line-${index}`}>
        {parts.length > 0 ? parts : line}
        {"\n"}
      </span>,
    );
  });
  flushCitations("cites-tail");

  return <>{blocks}</>;
}

export function AskAiPanel() {
  const open = useAppStore((s) => s.askAiOpen);
  const setOpen = useAppStore((s) => s.setAskAiOpen);
  const loanAssessment = useAppStore((s) => s.askAiLoanAssessment);
  const clearLoanAssessment = useAppStore(
    (s) => s.clearAskAiLoanAssessment,
  );
  const employeeId = useAppStore((s) => s.employeeId);
  const employees = useAppStore((s) => s.employees);
  const actor = employees.find((e) => e.id === employeeId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pollRefs = useRef(
    new Map<string, ReturnType<typeof setInterval>>(),
  );
  const handledLoanAssessmentIds = useRef(new Set<string>());

  const finishMessage = useCallback(
    (pendingId: string, content: string, run?: TaskRun) => {
      const timer = pollRefs.current.get(pendingId);
      if (timer) clearInterval(timer);
      pollRefs.current.delete(pendingId);
      setMessages((cur) =>
        cur.map((message) =>
          message.id === pendingId
            ? { ...message, content, pending: false, run: run ?? message.run }
            : message,
        ),
      );
      setRunning(pollRefs.current.size > 0);
    },
    [],
  );

  const trackRun = useCallback(
    (initialRun: TaskRun, pendingId: string) => {
      const previousTimer = pollRefs.current.get(pendingId);
      if (previousTimer) clearInterval(previousTimer);
      setRunning(true);
      setMessages((cur) =>
        cur.map((message) =>
          message.id === pendingId
            ? { ...message, run: initialRun, pending: initialRun.status !== "done" }
            : message,
        ),
      );

      const refresh = async () => {
        try {
          const next = await getTaskRunApi(initialRun.id, employeeId);
          const completed = next.steps.filter(
            (step) => step.status === "done",
          ).length;
          if (next.status === "done") {
            finishMessage(
              pendingId,
              next.finalAnswer ?? "Đã hoàn tất nhưng không có kết luận.",
              next,
            );
            return;
          }
          if (next.status === "failed") {
            finishMessage(
              pendingId,
              "Đánh giá thất bại — thử lại hoặc kiểm tra backend.",
              next,
            );
            return;
          }
          setMessages((cur) =>
            cur.map((message) =>
              message.id === pendingId
                ? {
                    ...message,
                    run: next,
                    pending: true,
                    content: `Đang đánh giá hồ sơ · ${completed}/${next.steps.length} chuyên gia hoàn tất`,
                  }
                : message,
            ),
          );
        } catch {
          /* giữ polling — lỗi mạng tạm thời */
        }
      };

      void refresh();
      pollRefs.current.set(
        pendingId,
        setInterval(() => void refresh(), 2000),
      );
    },
    [employeeId, finishMessage],
  );

  useEffect(() => {
    return () => {
      for (const timer of pollRefs.current.values()) clearInterval(timer);
      pollRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    if (
      !loanAssessment ||
      handledLoanAssessmentIds.current.has(loanAssessment.id)
    ) {
      return;
    }
    handledLoanAssessmentIds.current.add(loanAssessment.id);
    const pendingId = nextId();
    setMessages((cur) => [
      ...cur,
      {
        id: nextId(),
        role: "user",
        content: loanAssessment.prompt,
        loanLabel: `${loanAssessment.customerName} · ${loanAssessment.externalRef}`,
      },
      {
        id: pendingId,
        role: "assistant",
        content:
          "Đang điều phối Credit ‖ Legal ‖ Collateral → Product cho hồ sơ vay…",
        pending: loanAssessment.run.status !== "done",
        run: loanAssessment.run,
        loanLabel: `Đánh giá hồ sơ · ${loanAssessment.externalRef}`,
        loanRequestId: loanAssessment.loanRequestId,
      },
    ]);
    trackRun(loanAssessment.run, pendingId);
  }, [loanAssessment, trackRun]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  if (!open) return null;

  function newConversation() {
    for (const timer of pollRefs.current.values()) clearInterval(timer);
    pollRefs.current.clear();
    setMessages([]);
    setDraft("");
    setRunning(false);
    clearLoanAssessment();
  }

  async function ask(goal: string) {
    const trimmed = goal.trim();
    if (!trimmed || running) return;

    const pendingId = nextId();
    setMessages((cur) => [
      ...cur,
      { id: nextId(), role: "user", content: trimmed },
      {
        id: pendingId,
        role: "assistant",
        content: "Đang điều phối Credit ‖ Compliance → Product…",
        pending: true,
      },
    ]);
    setDraft("");
    setRunning(true);

    if (!isLiveApi()) {
      setTimeout(() => {
        finishMessage(
          pendingId,
          "Chế độ mô phỏng — bật NEXT_PUBLIC_API_URL để multi-agent trả lời thật.\n\nVí dụ kết quả: KH đủ điều kiện sơ bộ (CIC nhóm 1, DTI 42%), không có cảnh báo AML, gợi ý gói Vay mua nhà 8.5%/năm.",
        );
      }, 1200);
      return;
    }

    try {
      const run = await createTaskRunApi({
        goal: trimmed,
        employeeId,
        mode: "multi",
        async: true,
      });
      trackRun(run, pendingId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không gửi được câu hỏi";
      toast.error(message);
      finishMessage(pendingId, `Lỗi: ${message}`);
    }
  }

  return (
    <aside
      className={cn(
        "bg-background flex flex-col border-l",
        // mobile: phủ toàn màn hình
        "fixed inset-y-0 right-0 z-40 w-full shadow-xl",
        // desktop: cột thứ 3 cố định trong layout sidebar | content | ask ai
        "md:static md:z-auto md:h-full md:w-96 md:shrink-0 md:shadow-none lg:w-110 xl:w-130",
      )}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <Sparkles className="text-primary size-4" />
        <span className="flex-1 truncate text-sm font-semibold">
          Trợ lý AI
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={newConversation}
          title="Hội thoại mới"
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setOpen(false)}
          title="Đóng"
        >
          <X className="size-4" />
        </Button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 pt-10 text-center">
              <div className="from-primary/80 to-primary/30 flex size-16 items-center justify-center rounded-full bg-gradient-to-br">
                <Sparkles className="text-primary-foreground size-7" />
              </div>
              <div>
                <p className="text-base font-semibold">
                  Chào {actor?.displayName?.split("—")[0]?.trim() ?? "bạn"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Hỏi nhanh về hồ sơ vay, CIC, AML hoặc quy định tín dụng.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => void ask(s.goal)}
                    className="bg-muted/40 hover:bg-muted rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                  >
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      {s.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) =>
              m.role === "assistant" && m.run ? (
                // Perplexity-style: harness và nhận định là 2 khối rời, không bọc card ngoài
                <div key={m.id} className="flex w-full flex-col gap-3">
                  {m.loanLabel ? (
                    <p className="text-muted-foreground text-[11px] font-medium">
                      {m.loanLabel}
                    </p>
                  ) : null}
                  <AgentCoordinationProgress
                    activeRun={m.run}
                    isSimulating={m.pending}
                    className="shadow-none"
                  />
                  {m.pending ? (
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="size-3.5 animate-spin" />
                      {m.content}
                    </span>
                  ) : (
                    <div className="text-sm leading-6 whitespace-pre-line">
                      {renderAnswer(m.content)}
                    </div>
                  )}
                  {m.run.status === "done" && m.loanRequestId ? (
                    <AssessmentAction
                      loanRequestId={m.loanRequestId}
                      employeeId={employeeId}
                      suggestedTag={inferAssessmentTag(m.run)}
                      policyGateReasons={m.run.policyGateReasons}
                      appliedTag={m.appliedAssessmentTag}
                      submitted={m.submitted === true}
                      onApplied={(tag, submitted) =>
                        setMessages((current) =>
                          current.map((message) =>
                            message.id === m.id
                              ? {
                                  ...message,
                                  appliedAssessmentTag: tag,
                                  submitted,
                                }
                              : message,
                          ),
                        )
                      }
                    />
                  ) : null}
                </div>
              ) : (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-line",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground self-end"
                      : "bg-muted/60 self-start border",
                  )}
                >
                  {m.loanLabel ? (
                    <p
                      className={cn(
                        "mb-2 text-[11px] font-medium",
                        m.role === "user"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {m.loanLabel}
                    </p>
                  ) : null}
                  {m.pending ? (
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      {m.content}
                    </span>
                  ) : m.role === "assistant" ? (
                    <div className="leading-6">{renderAnswer(m.content)}</div>
                  ) : (
                    <div>{m.content}</div>
                  )}
                </div>
              ),
            )
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t p-3">
        <form
          className="bg-muted/30 focus-within:ring-ring flex items-end gap-2 rounded-lg border p-2 focus-within:ring-1"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(draft);
              }
            }}
            placeholder="Hỏi về khoản vay, KH, quy định…"
            rows={1}
            className="max-h-28 min-h-9 flex-1 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            className="size-8 shrink-0"
            disabled={running || !draft.trim()}
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </form>
      </footer>
    </aside>
  );
}

function AssessmentAction({
  loanRequestId,
  employeeId,
  suggestedTag,
  policyGateReasons,
  appliedTag,
  submitted,
  onApplied,
}: {
  loanRequestId: string;
  employeeId: string;
  suggestedTag: LoanAssessmentTag;
  policyGateReasons?: string[];
  appliedTag?: LoanAssessmentTag;
  submitted: boolean;
  onApplied: (tag: LoanAssessmentTag, submitted: boolean) => void;
}) {
  const [selectedTag, setSelectedTag] =
    useState<LoanAssessmentTag>(suggestedTag);
  const [staffNote, setStaffNote] = useState("");
  const [busyAction, setBusyAction] = useState<"tag" | "submit" | null>(null);

  async function applyTag() {
    setBusyAction("tag");
    try {
      await setLoanAssessmentTagApi({
        id: loanRequestId,
        employeeId,
        assessmentTag: selectedTag,
      });
      window.dispatchEvent(new Event("loan-request-updated"));
      onApplied(selectedTag, false);
      toast.success(`Đã gắn nhãn: ${ASSESSMENT_TAG_LABEL[selectedTag]}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể gắn nhãn hồ sơ",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function submitApproval() {
    const note = staffNote.trim();
    if (note.length < 5) {
      toast.error("Nhập ý kiến trình duyệt tối thiểu 5 ký tự");
      return;
    }
    setBusyAction("submit");
    try {
      await submitLoanApprovalApi({
        id: loanRequestId,
        employeeId,
        assessmentTag: selectedTag,
        staffNote: note,
      });
      window.dispatchEvent(new Event("loan-request-updated"));
      onApplied(selectedTag, true);
      toast.success("Đã gắn nhãn và trình Giám đốc");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Trình duyệt thất bại",
      );
    } finally {
      setBusyAction(null);
    }
  }

  if (submitted) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-4 shrink-0" />
        Đã gắn nhãn “{ASSESSMENT_TAG_LABEL[appliedTag ?? selectedTag]}” và trình
        Giám đốc.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-primary/25 bg-background p-3">
      <div>
        <p className="text-xs font-semibold">AI đề xuất nhãn thẩm định</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Nhân viên xác nhận hoặc đổi nhãn trước khi lưu.
        </p>
      </div>
      {policyGateReasons && policyGateReasons.length > 0 ? (
        <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
          <p className="font-semibold">
            Rule cứng đã ép nhãn (không phải LLM suy đoán):
          </p>
          {policyGateReasons.map((reason, i) => (
            <p key={i}>• {reason}</p>
          ))}
        </div>
      ) : null}
      <Select
        value={selectedTag}
        onValueChange={(value) =>
          setSelectedTag(value as LoanAssessmentTag)
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ASSESSMENT_TAG_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {value === suggestedTag ? `AI đề xuất · ${label}` : label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant={appliedTag === selectedTag ? "outline" : "default"}
        className="w-full"
        disabled={busyAction !== null || appliedTag === selectedTag}
        onClick={() => void applyTag()}
      >
        {busyAction === "tag" ? (
          <Loader2 className="animate-spin" />
        ) : appliedTag === selectedTag ? (
          <CheckCircle2 />
        ) : null}
        {appliedTag === selectedTag ? "Đã áp dụng nhãn" : "Áp dụng nhãn này"}
      </Button>
      <div className="border-t pt-3">
        <Textarea
          value={staffNote}
          onChange={(event) => setStaffNote(event.target.value)}
          placeholder="Ý kiến của nhân viên để trình Giám đốc…"
          rows={2}
        />
        <Button
          type="button"
          className="mt-2 w-full"
          disabled={busyAction !== null || staffNote.trim().length < 5}
          onClick={() => void submitApproval()}
        >
          {busyAction === "submit" ? <Loader2 className="animate-spin" /> : null}
          Gắn nhãn và trình Giám đốc
        </Button>
      </div>
    </div>
  );
}
