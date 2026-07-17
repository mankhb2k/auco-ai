"use client";

import {
  Sparkles,
  FileText,
  Search,
  PenTool,
  Clock,
  ArrowRight,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  AgentActivity,
  type AgentActivityStep,
  type AgentStepStatus,
} from "@/components/app/AgentActivity";

import type { ChatAgentAvatar } from "@/types/chat";

interface ChatProgressCardProps {
  type: "working" | "scheduling";
  avatar?: ChatAgentAvatar;
  onComplete?: () => void;
}

type StepDef = {
  id: string;
  label: string;
  detail?: string;
  icon: React.ReactNode;
};

const WORKING_STEPS: StepDef[] = [
  { id: "1", label: "Phân tích yêu cầu", icon: <Sparkles className="w-3 h-3" /> },
  {
    id: "2",
    label: "Đọc brand kit Tết",
    detail: "3 tài liệu",
    icon: <FileText className="w-3 h-3" />,
  },
  {
    id: "3",
    label: "Tìm xu hướng caption Tết",
    detail: "12 kết quả",
    icon: <Search className="w-3 h-3" />,
  },
  { id: "4", label: "Soạn 3 caption + CTA", icon: <PenTool className="w-3 h-3" /> },
  {
    id: "5",
    label: "Lên lịch đăng 09:00 ngày 28/1",
    icon: <Clock className="w-3 h-3" />,
  },
  {
    id: "6",
    label: "Chuyển Publisher chuẩn bị đăng",
    icon: <ArrowRight className="w-3 h-3" />,
  },
];

const SCHEDULING_STEPS: StepDef[] = [
  {
    id: "1",
    label: "Đồng bộ với hệ thống",
    icon: <Sparkles className="w-3 h-3" />,
  },
  {
    id: "2",
    label: "Đang thiết lập thời gian...",
    icon: <Clock className="w-3 h-3" />,
  },
];

/** Demo wrapper — auto chạy step, UI dùng AgentActivity (style chat-simulator) */
export const ChatProgressCard: React.FC<ChatProgressCardProps> = ({
  type,
  avatar,
  onComplete,
}) => {
  const defs = type === "working" ? WORKING_STEPS : SCHEDULING_STEPS;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= defs.length) {
      if (!onComplete) return undefined;
      const timer = setTimeout(onComplete, 800);
      return () => clearTimeout(timer);
    }

    const delay = type === "working" ? 800 + Math.random() * 400 : 1000;
    const timer = setTimeout(() => setCurrentIndex((i) => i + 1), delay);
    return () => clearTimeout(timer);
  }, [currentIndex, defs.length, onComplete, type]);

  const steps: AgentActivityStep[] = useMemo(
    () =>
      defs.map((def, idx) => {
        let status: AgentStepStatus = "pending";
        if (idx < currentIndex) status = "done";
        else if (idx === currentIndex) status = "running";
        return { ...def, status };
      }),
    [defs, currentIndex],
  );

  const state =
    currentIndex >= defs.length ? ("done" as const) : ("working" as const);

  return (
    <AgentActivity
      state={state}
      title={
        state === "done"
          ? "Đã hoàn thành"
          : type === "working"
            ? "Đang làm việc"
            : "Đang xử lý"
      }
      steps={steps}
      avatar={{
        text: avatar?.text ?? "TL",
        bg: avatar?.bg ?? "bg-emerald-500",
        src: avatar?.src,
      }}
    />
  );
};
