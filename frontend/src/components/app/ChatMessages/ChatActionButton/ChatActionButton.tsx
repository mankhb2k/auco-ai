"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Khớp `.glass-btn` chat-simulator — một style cho mọi CTA trong chat.
 */
export const CHAT_ACTION_BTN_CLASS = cn(
  "w-full min-h-[38px] flex items-center justify-center gap-1.5",
  "rounded-[10px] border border-white/90 bg-white/70 backdrop-blur-[8px]",
  "px-4 py-1.5 text-sm font-medium text-[#3390ec]",
  "shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
  "transition-[background-color,transform] duration-200 ease-in-out",
  "cursor-pointer select-none outline-none",
  "hover:bg-white/85",
  "active:scale-[0.99]",
  "focus-visible:bg-white/85",
  "disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100",
);


export interface ChatActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/** Một nút action. */
export function ChatActionButton({
  icon,
  children,
  className,
  type = "button",
  ...props
}: ChatActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(CHAT_ACTION_BTN_CLASS, className)}
      {...props}
    >
      {icon ? (
        <span className="flex shrink-0 items-center [&>svg]:stroke-[2.2]">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

export interface ChatActionItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface ChatActionButtonsProps {
  buttons: ChatActionItem[];
  /** Ẩn nút, hiện badge (vd. đã duyệt). */
  statusText?: string | null;
  className?: string;
}

/** Stack nút dưới bubble — map list → ChatActionButton. */
export function ChatActionButtons({
  buttons,
  statusText,
  className = "",
}: ChatActionButtonsProps) {
  if (statusText) {
    return (
      <div className={cn("mt-2 flex justify-start", className)}>
        <span className="select-none rounded-full border border-teal-100/90 bg-teal-50/70 px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-xs backdrop-blur-md animate-in fade-in duration-300">
          {statusText}
        </span>
      </div>
    );
  }

  if (buttons.length === 0) return null;

  return (
    <div
      className={cn("mt-1.5 flex w-full flex-col gap-[3px]", className)}
      role="group"
      aria-label="Hành động tin nhắn"
    >
      {buttons.map((btn) => (
        <ChatActionButton
          key={btn.id}
          icon={btn.icon}
          onClick={btn.onClick}
          disabled={btn.disabled}
        >
          {btn.label}
        </ChatActionButton>
      ))}
    </div>
  );
}
