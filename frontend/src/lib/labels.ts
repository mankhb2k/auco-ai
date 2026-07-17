import type { AgentRole, TaskRunStatus, TaskStepStatus } from "@/lib/types/domain";

export const AGENT_LABEL: Record<AgentRole, string> = {
  credit: "Credit",
  legal: "Legal / Compliance",
  product: "Product",
  ops: "Ops",
};

export function statusLabel(status: TaskRunStatus | TaskStepStatus) {
  switch (status) {
    case "planning":
      return "Đang lập kế hoạch";
    case "pending":
      return "Chờ";
    case "running":
      return "Đang chạy";
    case "waiting_approval":
      return "Chờ duyệt";
    case "done":
      return "Hoàn tất";
    case "failed":
      return "Thất bại";
    default:
      return status;
  }
}

export function statusVariant(
  status: TaskRunStatus | TaskStepStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "done":
      return "default";
    case "failed":
      return "destructive";
    case "waiting_approval":
      return "outline";
    default:
      return "secondary";
  }
}

export function formatTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return iso;
  }
}
