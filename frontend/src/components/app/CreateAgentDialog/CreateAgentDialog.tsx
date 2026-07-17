"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import React, { useId, useState } from "react";
import type { AgentTonePreset, CreateAgentInput } from "@auco-ai/shared";

export interface CreateAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAgentInput) => Promise<void>;
}

const TONE_OPTIONS: { value: AgentTonePreset; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
];

/**
 * Form tạo user agent nhanh (New Agent) — song song với coach AucoMother.
 * Remount via `key` ở parent khi mở lại để form reset.
 */
export function CreateAgentDialog({
  open,
  onClose,
  onSubmit,
}: CreateAgentDialogProps) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [description, setDescription] = useState("");
  const [tonePreset, setTonePreset] = useState<AgentTonePreset>("friendly");
  const [toneNotes, setToneNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName) {
      setError("Vui lòng nhập tên agent");
      return;
    }
    if (!trimmedRole) {
      setError("Vui lòng nhập vai trò");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const bioTrim = bio.trim();
      const descTrim = description.trim();
      const notesTrim = toneNotes.trim();
      await onSubmit({
        name: trimmedName,
        role: trimmedRole,
        tonePreset,
        enabledSkillGroups: [],
        ...(bioTrim ? { bio: bioTrim } : {}),
        ...(descTrim ? { description: descTrim } : {}),
        ...(notesTrim ? { toneNotes: notesTrim } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được agent. Thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#3390ec] focus:ring-2 focus:ring-[#3390ec]/20 disabled:opacity-60";

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
          Tạo agent mới
        </h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-4 p-5 overflow-y-auto"
        aria-labelledby={titleId}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="create-agent-name"
            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
          >
            Tên *
          </label>
          <input
            id="create-agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='vd. "Chuyên viên Tín Dụng"'
            maxLength={80}
            autoFocus
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="create-agent-role"
            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
          >
            Vai trò *
          </label>
          <input
            id="create-agent-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder='vd. "Credit Agent"'
            maxLength={120}
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="create-agent-tone"
            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
          >
            Tone
          </label>
          <select
            id="create-agent-tone"
            value={tonePreset}
            onChange={(e) => setTonePreset(e.target.value as AgentTonePreset)}
            disabled={submitting}
            className={inputClass}
          >
            {TONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="create-agent-bio"
            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
          >
            Bio
          </label>
          <input
            id="create-agent-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Giới thiệu ngắn trên sidebar"
            maxLength={280}
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="create-agent-desc"
            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
          >
            Mô tả (làm / không làm)
          </label>
          <textarea
            id="create-agent-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Phạm vi làm việc và những việc KHÔNG làm"
            maxLength={4000}
            rows={3}
            disabled={submitting}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="create-agent-tone-notes"
            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
          >
            Ghi chú tone
          </label>
          <input
            id="create-agent-tone-notes"
            value={toneNotes}
            onChange={(e) => setToneNotes(e.target.value)}
            placeholder='vd. "Xưng bạn, dùng emoji nhẹ"'
            maxLength={500}
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <p className="text-xs text-slate-400">
          Chưa rõ nên thiết lập chuyên gia nào? Chat với AucoMother trên tab Agent để được coach.
        </p>

        {error && (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-auto flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting || !name.trim() || !role.trim()}
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
