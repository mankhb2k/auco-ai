"use client";

import { useEffect, useRef, useState } from "react";
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
  Paperclip,
  Image,
  FileText,
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

  const [selectedFiles, setSelectedFiles] = useState<{ id: string; file: File; type: string }[]>([]);
  const [selectedImages, setSelectedImages] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const canSend = !isSimulating && goalDraft.trim().length > 0;
  const showChips = !activeRun;

  const handleSend = () => {
    if (!canSend) return;
    submitGoal();
    setSelectedFiles([]);
    selectedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setSelectedImages([]);
  };

  return (
    <div className="bg-background px-4 py-3 pb-5">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) return;

          let addedCount = 0;
          const newFiles: { id: string; file: File; type: string }[] = [];

          for (const file of files) {
            const currentTotal = selectedFiles.length + selectedImages.length + newFiles.length;
            if (currentTotal >= 10) {
              toast.error("Giới hạn tối đa 10 tài liệu + hình ảnh cho mỗi lần gửi!");
              break;
            }
            if (file.size > 20 * 1024 * 1024) {
              toast.error(`Tệp "${file.name}" vượt quá giới hạn dung lượng 20MB!`);
              continue;
            }
            const isDuplicate = selectedFiles.some(
              (f) => f.file.name === file.name && f.file.size === file.size
            ) || newFiles.some(
              (f) => f.file.name === file.name && f.file.size === file.size
            );
            if (isDuplicate) {
              toast.error(`Tài liệu "${file.name}" đã được đính kèm!`);
              continue;
            }
            const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
            newFiles.push({
              id: Math.random().toString(36).substring(7),
              file,
              type: ext,
            });
            addedCount++;
          }

          if (newFiles.length > 0) {
            setSelectedFiles((prev) => [...prev, ...newFiles]);
            toast.success(`Đã đính kèm ${addedCount} tài liệu!`);
          }
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        multiple
        accept="image/*"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) return;

          let addedCount = 0;
          const newImages: { id: string; file: File; previewUrl: string }[] = [];

          for (const file of files) {
            const currentTotal = selectedFiles.length + selectedImages.length + newImages.length;
            if (currentTotal >= 10) {
              toast.error("Giới hạn tối đa 10 tài liệu + hình ảnh cho mỗi lần gửi!");
              break;
            }
            if (file.size > 20 * 1024 * 1024) {
              toast.error(`Hình ảnh "${file.name}" vượt quá giới hạn dung lượng 20MB!`);
              continue;
            }
            const isDuplicate = selectedImages.some(
              (img) => img.file.name === file.name && img.file.size === file.size
            ) || newImages.some(
              (img) => img.file.name === file.name && img.file.size === file.size
            );
            if (isDuplicate) {
              toast.error(`Hình ảnh "${file.name}" đã được đính kèm!`);
              continue;
            }
            newImages.push({
              id: Math.random().toString(36).substring(7),
              file,
              previewUrl: URL.createObjectURL(file),
            });
            addedCount++;
          }

          if (newImages.length > 0) {
            setSelectedImages((prev) => [...prev, ...newImages]);
            toast.success(`Đã đính kèm ${addedCount} hình ảnh!`);
          }
          e.target.value = "";
        }}
      />
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
          {/* Attachments Row */}
          {(selectedFiles.length > 0 || selectedImages.length > 0) && (
            <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1">
              {/* Selected Files */}
              {selectedFiles.map((file) => (
                <div
                  key={file.id}
                  className="relative flex items-center gap-2 bg-background dark:bg-zinc-900 border rounded-xl px-3 py-1.5 max-w-[200px] shadow-sm group animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white shadow-sm">
                    <FileText className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium truncate text-foreground leading-tight">
                      {file.file.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider leading-none mt-0.5">
                      {file.type}
                    </p>
                  </div>
                  
                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFiles((prev) => prev.filter((f) => f.id !== file.id));
                    }}
                    className="absolute -top-1.5 -right-1.5 size-4.5 rounded-full bg-white text-zinc-900 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md border border-zinc-200"
                    style={{ width: "18px", height: "18px" }}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}

              {/* Selected Images */}
              {selectedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative size-12 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm bg-background group animate-in fade-in zoom-in-95 duration-150"
                >
                  <img
                    src={img.previewUrl}
                    alt="Preview"
                    className="size-full object-cover rounded-xl"
                  />
                  
                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(img.previewUrl);
                      setSelectedImages((prev) => prev.filter((i) => i.id !== img.id));
                    }}
                    className="absolute -top-1.5 -right-1.5 size-4.5 rounded-full bg-white text-zinc-900 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md border border-zinc-200"
                    style={{ width: "18px", height: "18px" }}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={showChips ? 3 : 2}
            placeholder="Mô tả yêu cầu nghiệp vụ…"
            disabled={isSimulating}
            className="max-h-40 min-h-[72px] resize-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Đính kèm tài liệu"
                disabled={isSimulating}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Đính kèm hình ảnh"
                disabled={isSimulating}
                onClick={() => imageInputRef.current?.click()}
              >
                <Image className="size-4" />
              </Button>
            </div>
            <Button
              size="icon"
              className="size-8 rounded-full"
              disabled={!canSend}
              onClick={handleSend}
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
