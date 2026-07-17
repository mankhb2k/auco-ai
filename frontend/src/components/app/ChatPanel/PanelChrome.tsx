"use client";

import { ArrowLeft, Pen, X } from "lucide-react";
import React, { useState, type ReactNode } from "react";

export interface PanelChromeProps {
  title: string;
  /** When scrolled deep, header shows this instead of title. */
  scrolledTitle?: string;
  onClose: () => void;
  showEdit?: boolean;
  onEdit?: () => void;
  children: ReactNode;
}

/**
 * Shared right-panel chrome: rounded frame + sticky header that swaps X → ArrowLeft on scroll.
 */
export function PanelChrome({
  title,
  scrolledTitle,
  onClose,
  showEdit = true,
  onEdit,
  children,
}: PanelChromeProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const isScrolled = scrollTop > 0;
  const isFullyScrolled = scrollTop >= 310;
  const headerTitle =
    isFullyScrolled && scrolledTitle ? scrolledTitle : title;

  return (
    <div className="w-full h-full bg-[#f4f4f5] rounded-2xl flex flex-col flex-shrink-0 overflow-hidden">
      <div
        className={`h-14 px-4 flex items-center justify-between flex-shrink-0 bg-[#f4f4f5] transition-all duration-200 ${
          isScrolled && !isFullyScrolled
            ? "border-b border-gray-200/80 shadow-xs"
            : "border-b border-transparent"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-all cursor-pointer"
            aria-label="Đóng panel"
          >
            {isFullyScrolled ? (
              <ArrowLeft size={20} className="stroke-[2.2]" />
            ) : (
              <X size={20} className="stroke-[2.2]" />
            )}
          </button>
          <h2 className="font-bold text-xl text-gray-900 transition-all duration-150">
            {headerTitle}
          </h2>
        </div>
        {showEdit && !isFullyScrolled && (
          <button
            type="button"
            onClick={onEdit}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-all cursor-pointer"
            aria-label="Chỉnh sửa"
          >
            <Pen size={18} className="stroke-[2.2]" />
          </button>
        )}
      </div>

      <div
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="chat-scroll-view flex-1 thin-scrollbar pb-3"
      >
        {children}
      </div>
    </div>
  );
}
