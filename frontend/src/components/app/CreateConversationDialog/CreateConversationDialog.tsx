"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import React, { useId, useState } from "react";
import type { ConversationType } from "@auco-ai/shared";

export interface CreateConversationDialogProps {
  open: boolean;
  type: ConversationType;
  onClose: () => void;
  onSubmit: (input: {
    type: ConversationType;
    title: string;
    description?: string;
  }) => Promise<void>;
}

const COPY: Record<
  ConversationType,
  { title: string; nameLabel: string; nameHint: string; descHint: string }
> = {
  session: {
    title: "Phiên chat mới",
    nameLabel: "Tên phiên",
    nameHint: 'vd. "Thẩm định doanh nghiệp X"',
    descHint: "Mô tả ngắn (tùy chọn)",
  },
  room: {
    title: "Tạo phòng mới",
    nameLabel: "Tên phòng",
    nameHint: 'vd. "Phòng Tín Dụng Doanh Nghiệp"',
    descHint: "Bạn có thể thêm mô tả cho phòng",
  },
};

/**
 * Form tạo Room (New Group). New Chat tạo session ngay — không dùng dialog này.
 * Remount via `key` ở parent khi mở lại để form reset.
 */
export function CreateConversationDialog({
  open,
  type,
  onClose,
  onSubmit,
}: CreateConversationDialogProps) {
  const titleId = useId();
  const copy = COPY[type];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên");
      return;
    }
    if (trimmed.length > 120) {
      setError("Tên tối đa 120 ký tự");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const desc = description.trim();
      await onSubmit({
        type,
        title: trimmed,
        ...(desc ? { description: desc } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được. Thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="flex h-9 w-9 items-center justify-center rounded-full border-none bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          aria-label="Quay lại"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 id={titleId} className="text-base font-semibold text-slate-900">
          {copy.title}
        </h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-4 p-5 overflow-y-auto"
        aria-labelledby={titleId}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="create-conv-title"
            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
          >
            {copy.nameLabel} *
          </label>
          <input
            id="create-conv-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={copy.nameHint}
            maxLength={120}
            autoFocus
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#3390ec] focus:ring-2 focus:ring-[#3390ec]/20 disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="create-conv-desc"
            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
          >
            Mô tả
          </label>
          <textarea
            id="create-conv-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={copy.descHint}
            maxLength={500}
            rows={3}
            disabled={submitting}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#3390ec] focus:ring-2 focus:ring-[#3390ec]/20 disabled:opacity-60"
          />
        </div>

        {error && (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-auto flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="flex h-11 min-w-[110px] items-center justify-center gap-2 rounded-full border-none bg-[#3390ec] px-5 text-sm font-semibold text-white cursor-pointer hover:bg-[#2580db] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tạo…
              </>
            ) : (
              "Tạo"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
