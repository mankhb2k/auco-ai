"use client";

import React, { useState } from "react";
import { 
  Brain, 
  ChevronDown, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  PlayCircle,
  Cpu,
  Clock,
  DollarSign,
  Network
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskRun, TaskStep } from "@/lib/types/domain";

interface AgentCoordinationProgressProps {
  activeRun: TaskRun;
  isSimulating?: boolean;
  className?: string;
}

export function AgentCoordinationProgress({
  activeRun,
  isSimulating = false,
  className
}: AgentCoordinationProgressProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!activeRun) return null;

  const totalSteps = activeRun.steps.length;
  const doneSteps = activeRun.steps.filter((s) => s.status === "done").length;
  const isRunning = isSimulating || activeRun.status === "running";
  const hasWaitingApproval = activeRun.steps.some((s) => s.status === "waiting_approval");

  // Determine SHB theme colors for status
  const statusColorClass = isRunning
    ? "text-orange-500"
    : hasWaitingApproval
    ? "text-amber-500"
    : "text-emerald-500";

  // Helper for agent names
  const getAgentLabel = (role: string) => {
    switch (role) {
      case "credit":
        return "Credit (Thẩm định)";
      case "legal":
        return "Legal / Compliance (Pháp lý & Tuân thủ)";
      case "product":
        return "Product (Phát triển sản phẩm)";
      case "ops":
        return "Operations (Vận hành)";
      default:
        return role.toUpperCase();
    }
  };

  // Helper for status badge styling
  const getStatusBadge = (status: TaskStep["status"]) => {
    switch (status) {
      case "done":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 shadow-sm">
            <CheckCircle2 className="size-3" /> Hoàn tất
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-200/50 dark:border-orange-850/30 animate-pulse shadow-sm">
            <Loader2 className="size-3 animate-spin" /> Đang chạy
          </span>
        );
      case "waiting_approval":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30 shadow-sm animate-bounce">
            <AlertCircle className="size-3" /> Chờ duyệt
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/30 shadow-sm">
            <AlertCircle className="size-3" /> Lỗi
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shadow-sm">
            Chờ thực hiện
          </span>
        );
    }
  };

  // Extract the DAG pin path (e.g. Credit || Legal -> Product)
  const getDagPinText = () => {
    if (activeRun.scenario === "corporate") {
      return "Credit || Legal ➔ Product (DN 50 tỷ / TT39)";
    }
    if (activeRun.scenario === "fx") {
      return "Ops ➔ Legal (Mua bán ngoại tệ tệ / TT02)";
    }
    return "Credit ➔ Ops (Vay thế chấp / TT01)";
  };

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-zinc-200/80 bg-white shadow-lg shadow-zinc-100/50 dark:border-zinc-800/80 dark:bg-zinc-950 dark:shadow-none overflow-hidden transition-all duration-300",
        className
      )}
    >
      {/* Trigger Area */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-zinc-50/50 to-white dark:from-zinc-900/30 dark:to-zinc-950 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors border-b border-zinc-100 dark:border-zinc-900"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/30 text-orange-600 dark:text-orange-400 shadow-inner">
            <Brain className={cn("size-5", isRunning && "animate-pulse")} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm tracking-tight flex items-center gap-1">
                <Sparkles className="size-3.5 text-orange-500 fill-orange-500" />
                SHB PLANNER ·
              </span>
              <span className="text-xs uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">
                {activeRun.scenario}
              </span>
            </div>
            <span className={cn("text-xs font-medium transition-colors duration-300", statusColorClass)}>
              {isRunning
                ? "Đang suy nghĩ & điều phối luồng nghiệp vụ..."
                : `Đã xử lý xong · ${doneSteps}/${totalSteps} bước nghiệp vụ`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="size-4 animate-spin text-orange-500" />}
          <ChevronDown
            className={cn(
              "size-5 text-zinc-400 transition-transform duration-300",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Content Area */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-4 space-y-4">
            {/* Summary */}
            <div className="text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-900/40 rounded-xl p-3 border border-zinc-100 dark:border-zinc-900/50 leading-relaxed font-normal">
              {activeRun.planJson.summary}
            </div>

            {/* Pinned DAG */}
            <div className="flex items-center gap-2 text-xs bg-orange-50/30 dark:bg-orange-950/10 border border-dashed border-orange-200/50 dark:border-orange-900/20 rounded-xl px-3 py-2 text-zinc-600 dark:text-zinc-400 font-mono">
              <Network className="size-3.5 text-orange-500" />
              <span className="font-semibold text-zinc-400 dark:text-zinc-500">DAG ghim:</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-medium">{getDagPinText()}</span>
            </div>

            {/* Steps Timeline */}
            <div className="relative border-l-2 border-zinc-100 dark:border-zinc-800/80 ml-3.5 pl-6 space-y-6 py-2">
              {activeRun.steps.map((step, idx) => {
                const isStepDone = step.status === "done";
                const isStepRunning = step.status === "running";
                const isStepPending = step.status === "pending";
                const isStepApproval = step.status === "waiting_approval";

                return (
                  <div key={step.id} className="relative group">
                    {/* Node Dot */}
                    <div
                      className={cn(
                        "absolute -left-[31px] top-1.5 flex size-5 items-center justify-center rounded-full border bg-white dark:bg-zinc-950 transition-all duration-300 shadow-sm",
                        isStepDone
                          ? "border-emerald-500 text-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : isStepRunning
                          ? "border-orange-500 text-orange-500 bg-orange-50 dark:bg-orange-950/20 animate-pulse"
                          : isStepApproval
                          ? "border-amber-500 text-amber-500 bg-amber-50 dark:bg-amber-950/20"
                          : "border-zinc-200 text-zinc-300 dark:border-zinc-800"
                      )}
                    >
                      {isStepDone ? (
                        <CheckCircle2 className="size-3 fill-emerald-500 text-white dark:text-zinc-950" />
                      ) : isStepRunning ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : isStepApproval ? (
                        <AlertCircle className="size-3 fill-amber-500 text-white dark:text-zinc-950" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      )}
                    </div>

                    {/* Step Card Content */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm tracking-tight">
                            {getAgentLabel(step.agentRole)}
                          </span>
                        </div>
                        {getStatusBadge(step.status)}
                      </div>

                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 leading-normal pl-0.5">
                        {step.label}
                      </p>

                      {/* Workers Sub-steps */}
                      {step.workers && step.workers.length > 0 && (
                        <ul className="space-y-1.5 pl-2.5 py-1">
                          {step.workers.map((w) => (
                            <li
                              key={w.id}
                              className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"
                            >
                              <div
                                className={cn(
                                  "size-1.5 rounded-full",
                                  w.status === "done"
                                    ? "bg-emerald-500"
                                    : w.status === "running"
                                    ? "bg-orange-500 animate-ping"
                                    : "bg-zinc-300 dark:bg-zinc-700"
                                )}
                              />
                              <span className={cn(w.status === "done" && "text-zinc-400 line-through/none")}>
                                {w.label}
                              </span>
                              {w.status === "done" && (
                                <CheckCircle2 className="size-3 text-emerald-500 inline-block ml-0.5" />
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Tools Tag list */}
                      {step.toolCalls && step.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {step.toolCalls.map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 text-[10px] font-mono text-zinc-500 dark:text-zinc-400"
                            >
                              <Cpu className="size-2.5" /> {t.tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Token Metrics Footer */}
            {activeRun.usage && activeRun.usage.totalTokens > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-900/60 text-[11px] text-zinc-400 dark:text-zinc-500">
                <div className="flex items-center gap-1 font-medium bg-zinc-50 dark:bg-zinc-900 px-2 py-1 rounded-md border border-zinc-100 dark:border-zinc-800/50">
                  <Cpu className="size-3 text-zinc-400" />
                  <span>{activeRun.usage.totalTokens.toLocaleString()} tokens</span>
                </div>
                <div className="flex items-center gap-1 font-medium bg-zinc-50 dark:bg-zinc-900 px-2 py-1 rounded-md border border-zinc-100 dark:border-zinc-800/50">
                  <DollarSign className="size-3 text-zinc-400" />
                  <span>${activeRun.usage.costUsd.toFixed(4)}</span>
                </div>
                <div className="flex items-center gap-1 font-medium bg-zinc-50 dark:bg-zinc-900 px-2 py-1 rounded-md border border-zinc-100 dark:border-zinc-800/50">
                  <Clock className="size-3 text-zinc-400" />
                  <span>{(activeRun.usage.wallClockMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
