"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DagView } from "@/components/dashboard/DagView";
import { TraceTimeline } from "@/components/dashboard/TraceTimeline";
import { UsagePanel } from "@/components/dashboard/UsagePanel";
import { AGENT_LABEL, statusLabel } from "@/lib/labels";
import { SCENARIO_PRESETS } from "@/lib/mock/scenarios";
import { formatTokens, formatUsd } from "@/lib/mock/usage";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app.store";
import { AgentCoordinationProgress } from "@/components/chat/AgentCoordinationProgress";
import {
  ArrowUp,
  Brain,
  Check,
  ChevronDown,
  Loader2,
  Network,
  Sparkles,
  X,
} from "lucide-react";

// ThinkingBlock replaced by AgentCoordinationProgress

function renderAssessment(text: string) {
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    const bold = line.replace(/\*\*(.+?)\*\*/g, "$1");
    const isHeading = line.startsWith("**");
    return (
      <p
        key={i}
        className={
          isHeading
            ? "mt-3 text-sm font-semibold first:mt-0"
            : "text-sm leading-relaxed text-foreground/90"
        }
      >
        {bold}
      </p>
    );
  });
}

function AgentAssessments() {
  const activeRun = useAppStore((s) => s.activeRun);
  if (!activeRun) return null;

  // Khi đã có final answer, chỉ hiện final — tránh trùng
  if (activeRun.finalAnswer) return null;

  const withText = activeRun.steps.filter(
    (s) =>
      s.assessment &&
      (s.status === "done" ||
        s.status === "waiting_approval" ||
        s.status === "failed"),
  );
  if (withText.length === 0) return null;

  return (
    <div className="space-y-5">
      {withText.map((step) => (
        <div key={step.id} className="space-y-1">
          {renderAssessment(step.assessment!)}
          {step.citations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {step.citations.map((c) => (
                <Badge
                  key={`${step.id}-${c.sourceDoc}-${c.section}`}
                  variant="secondary"
                  className="max-w-full truncate font-normal"
                  title={`${c.sourceDoc} · ${c.section}`}
                >
                  {c.sourceDoc}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ApprovalActions() {
  const activeRun = useAppStore((s) => s.activeRun);
  const approveStep = useAppStore((s) => s.approveStep);
  const rejectStep = useAppStore((s) => s.rejectStep);
  const pending =
    activeRun?.steps.filter((s) => s.status === "waiting_approval") ?? [];

  if (pending.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {pending.map((step) => (
        <div key={step.id} className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              approveStep(step.id);
              toast.success("Đã duyệt");
            }}
          >
            <Check className="size-4" />
            Duyệt
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              rejectStep(step.id);
              toast.error("Đã từ chối");
            }}
          >
            <X className="size-4" />
            Từ chối
          </Button>
        </div>
      ))}
    </div>
  );
}

function AssistantAnswer() {
  const activeRun = useAppStore((s) => s.activeRun);
  if (!activeRun?.finalAnswer) return null;

  return (
    <div className="space-y-4">
      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
        {activeRun.finalAnswer}
      </div>
      {activeRun.citations.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {activeRun.citations.map((c) => (
            <Badge
              key={`${c.sourceDoc}-${c.section}`}
              variant="secondary"
              className="max-w-full truncate font-normal"
              title={`${c.sourceDoc} · ${c.section}`}
            >
              {c.sourceDoc}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailsSheet() {
  const activeRun = useAppStore((s) => s.activeRun);
  if (!activeRun) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2 text-xs">
          Chi tiết DAG · Trace · Cost
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Quan sát vận hành</SheetTitle>
          <SheetDescription>
            DAG, timeline tool/citation và token — tách khỏi luồng chat chính.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <DagView />
          <TraceTimeline />
          <UsagePanel />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyHero() {
  const applyScenarioPreset = useAppStore((s) => s.applyScenarioPreset);
  const setGoalDraft = useAppStore((s) => s.setGoalDraft);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 pb-8">
      <div className="bg-primary text-primary-foreground mb-5 flex size-12 items-center justify-center rounded-2xl">
        <Network className="size-5" />
      </div>
      <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        Hỏi Planner bất kỳ yêu cầu nghiệp vụ
      </h2>
      <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
        Một ô chat duy nhất. Chuyên gia Credit, Legal, Product được điều phối
        tự động — bạn chỉ cần duyệt khi có side-effect.
      </p>
      <div className="mt-8 flex w-full flex-wrap justify-center gap-2">
        {SCENARIO_PRESETS.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              applyScenarioPreset(p.id, p.goal);
              setGoalDraft(p.goal);
            }}
          >
            <Sparkles className="size-3.5" />
            {p.shortLabel}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Conversation() {
  const activeRun = useAppStore((s) => s.activeRun);
  const isSimulating = useAppStore((s) => s.isSimulating);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    activeRun?.status,
    activeRun?.steps.map((s) => s.status).join(","),
    activeRun?.finalAnswer,
    activeRun?.usage.events.length,
  ]);

  if (!activeRun) return <EmptyHero />;

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        {/* User turn */}
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground max-w-[90%] rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
            {activeRun.goal}
          </div>
        </div>

        {/* Assistant turn */}
        <div className="space-y-5">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <Sparkles className="size-3.5" />
            Planner
            <Badge variant="outline" className="normal-case">
              {activeRun.scenario}
            </Badge>
          </div>

          <AgentCoordinationProgress activeRun={activeRun} isSimulating={isSimulating} />
          <AgentAssessments />
          <ApprovalActions />
          <AssistantAnswer />

          {(activeRun.status === "done" || activeRun.status === "failed") && (
            <div className="flex items-center gap-2 pt-1">
              <DetailsSheet />
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function ChatComposer() {
  const goalDraft = useAppStore((s) => s.goalDraft);
  const setGoalDraft = useAppStore((s) => s.setGoalDraft);
  const submitGoal = useAppStore((s) => s.submitGoal);
  const isSimulating = useAppStore((s) => s.isSimulating);
  const activeRun = useAppStore((s) => s.activeRun);
  const applyScenarioPreset = useAppStore((s) => s.applyScenarioPreset);
  const scenarioId = useAppStore((s) => s.scenarioId);

  const canSend = !isSimulating && goalDraft.trim().length > 0;
  const showChips = !activeRun;

  return (
    <div className="bg-background/95 border-t px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto w-full max-w-2xl space-y-2">
        {showChips ? (
          <div className="flex flex-wrap gap-1.5">
            {SCENARIO_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={isSimulating}
                onClick={() => applyScenarioPreset(p.id, p.goal)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  scenarioId === p.id
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {p.shortLabel}
              </button>
            ))}
          </div>
        ) : null}
        <div className="bg-muted/40 focus-within:ring-ring relative rounded-2xl border shadow-sm focus-within:ring-1">
          <Textarea
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) submitGoal();
              }
            }}
            rows={showChips ? 3 : 2}
            placeholder="Mô tả yêu cầu nghiệp vụ…"
            disabled={isSimulating}
            className="max-h-40 min-h-[72px] resize-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-muted-foreground text-[11px]">
              Enter gửi · Shift+Enter xuống dòng
            </span>
            <Button
              size="icon"
              className="size-8 rounded-full"
              disabled={!canSend}
              onClick={submitGoal}
            >
              {isSimulating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatWorkspace() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation />
      <ChatComposer />
    </div>
  );
}
