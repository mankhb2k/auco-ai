"use client";

import React from "react";
import {
  BLOCK_GROUP_META,
  BLOCK_STATUS_DOT,
  BLOCK_STATUS_LABEL,
} from "./block.meta";
import type { BlockGroup, BlockStatus } from "@/lib/workflowMockGraphs";

export interface BlockProps {
  title: string;
  /** Mặc định lấy theo group ("Trigger Node", …) */
  subtitle?: string;
  group: BlockGroup;
  /** Emoji hoặc React node (lucide) — hiện trắng trên nền màu group */
  icon?: React.ReactNode;
  status?: BlockStatus;
  enabled?: boolean;
  selected?: boolean;
  className?: string;
  /** Hiện chấm trạng thái nhỏ góc dưới text */
  showStatus?: boolean;
}

/**
 * Khối Block catalog — card trắng + ô icon màu (phong cách workflow reference).
 * Pure UI: không gắn React Flow Handle; dùng trong canvas qua BlockNode wrapper.
 */
export function Block({
  title,
  subtitle,
  group,
  icon,
  status = "idle",
  enabled = true,
  selected = false,
  className = "",
  showStatus = true,
}: BlockProps) {
  const meta = BLOCK_GROUP_META[group] ?? BLOCK_GROUP_META.processing;

  return (
    <div
      className={[
        "relative flex w-[240px] items-center gap-3 rounded-2xl px-3.5 py-3",
        "bg-gradient-to-b from-white to-[#f5f5f7]",
        "border border-gray-200/80 shadow-sm",
        selected ? "ring-2 ring-[#3390ec]/35" : "",
        !enabled ? "opacity-50 grayscale" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Icon tile */}
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-white text-lg shadow-sm ${meta.iconBg}`}
        aria-hidden
      >
        {icon ?? "◻"}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold leading-tight text-[#0f172a]">
          {title}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-[#6e6e73]">
          {subtitle ?? meta.label}
        </p>

        {showStatus && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${BLOCK_STATUS_DOT[status]}`}
            />
            <span>{enabled ? BLOCK_STATUS_LABEL[status] : "Đã tắt"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
