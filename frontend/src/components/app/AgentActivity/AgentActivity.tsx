"use client";

import { Check, Loader2 } from "lucide-react";
import React from "react";
import { Avatar, MESSAGE_AVATAR_SIZE } from "@/components/ui/Avatar/Avatar";

export type AgentActivityState = "working" | "done" | "error";
export type AgentStepStatus = "pending" | "running" | "done" | "error";

export interface AgentActivityStep {
  id: string;
  label: string;
  detail?: string;
  icon?: React.ReactNode;
  status: AgentStepStatus;
}

export interface AgentActivityProps {
  /** Tiêu đề header — mặc định theo state */
  title?: string;
  state?: AgentActivityState;
  steps: AgentActivityStep[];
  /** Avatar agent — cùng hệ Avatar UI (text / bg / src) */
  avatar?: {
    text?: string;
    bg?: string;
    src?: string;
    /** @deprecated dùng `bg` */
    className?: string;
  };
  showAvatar?: boolean;
  className?: string;
}

const DEFAULT_TITLE: Record<AgentActivityState, string> = {
  working: "Đang làm việc",
  done: "Đã hoàn thành",
  error: "Có lỗi xảy ra",
};

const BUBBLE_CLASS: Record<AgentStepStatus, string> = {
  done: "bg-emerald-50 border-transparent text-emerald-600",
  running:
    "animate-agent-ring bg-sky-50 border-transparent text-[#0ea5e9]",
  error: "bg-rose-50 border-transparent text-rose-600",
  pending: "bg-white border-slate-200 text-slate-400",
};

const LABEL_CLASS: Record<AgentStepStatus, string> = {
  done: "text-slate-500",
  running: "animate-agent-shimmer text-[#0ea5e9]",
  error: "text-rose-600",
  pending: "text-slate-800",
};

/**
 * Card agent đang thực thi hành động — cùng phong cách activity-card
 * của chat-simulator trên landing page (Tailwind only).
 */
export function AgentActivity({
  title,
  state = "working",
  steps,
  avatar = { text: "TL", bg: "bg-emerald-500" },
  showAvatar = true,
  className = "",
}: AgentActivityProps) {
  const doneCount = steps.filter((s) => s.status === "done").length;
  const headerTitle = title ?? DEFAULT_TITLE[state];
  const countLabel = `${Math.min(doneCount + (state === "working" ? 1 : 0), steps.length)}/${steps.length}`;
  const avatarBg = avatar.bg ?? avatar.className ?? "bg-emerald-500";

  return (
    <div
      className={`mb-1.5 flex items-start gap-2 animate-in fade-in duration-300 ${className}`.trim()}
    >
      {showAvatar && (
        <Avatar
          size={MESSAGE_AVATAR_SIZE}
          src={avatar.src}
          text={avatar.text ?? "AA"}
          bg={avatarBg}
          alt="Agent"
          className="mt-0.5"
        />
      )}

      <div className="box-border flex w-full max-w-[min(440px,85%)] flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              state === "working"
                ? "animate-agent-pulse bg-[#0ea5e9]"
                : state === "done"
                  ? "bg-emerald-500"
                  : "bg-rose-500"
            }`}
          />
          <span className="flex-1 text-sm font-semibold text-slate-800">
            {headerTitle}
          </span>
          <span className="text-xs font-medium text-slate-500">{countLabel}</span>
        </div>

        <ol className="m-0 flex list-none flex-col p-0">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const connectorFilled = step.status === "done";
            const connectorFlowing = step.status === "running";

            return (
              <li key={step.id} className="flex min-h-[34px] gap-3">
                <span className="relative w-6 shrink-0 self-stretch">
                  <span
                    className={`relative z-[2] box-border flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${BUBBLE_CLASS[step.status]}`}
                  >
                    {step.status === "done" ? (
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    ) : step.status === "running" ? (
                      <Loader2
                        className="h-3 w-3 animate-spin"
                        strokeWidth={2.5}
                      />
                    ) : (
                      <span className="flex h-[13px] w-[13px] items-center justify-center [&_svg]:h-[13px] [&_svg]:w-[13px]">
                        {step.icon}
                      </span>
                    )}
                  </span>

                  {!isLast && (
                    <span
                      className={`absolute top-6 bottom-0 left-1/2 z-0 w-0.5 -translate-x-1/2 overflow-visible rounded-sm ${
                        connectorFilled ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    >
                      {connectorFlowing && (
                        <>
                          <span className="absolute inset-0 origin-top animate-agent-flow rounded-sm bg-[#0ea5e9]" />
                          <span className="absolute left-1/2 z-[1] h-1.5 w-1.5 -translate-x-1/2 animate-agent-flow-dot rounded-full bg-[#0ea5e9] shadow-[0_0_6px_#0ea5e9]" />
                        </>
                      )}
                    </span>
                  )}
                </span>

                <div className="flex min-w-0 flex-col justify-center pb-2">
                  <span
                    className={`text-sm font-medium ${LABEL_CLASS[step.status]}`}
                  >
                    {step.label}
                  </span>
                  {step.detail &&
                    (step.status === "done" || step.status === "running") && (
                      <span className="mt-0.5 truncate text-xs text-slate-500">
                        {step.detail}
                      </span>
                    )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
