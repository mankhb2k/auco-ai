import type { AgentRole, TaskRunStatus, TaskStepStatus } from "@/lib/types/domain";

/** Nhãn tiếng Việt cho mockup demo — không đổi key dữ liệu nội bộ. */

export const AGENT_LABEL: Record<AgentRole, string> = {
  planner: "Điều phối",
  credit: "Tín dụng",
  legal: "Pháp lý / Tuân thủ",
  product: "Sản phẩm",
  ops: "Vận hành",
};

export const DOMAIN_LABEL: Record<string, string> = {
  credit: "Tín dụng",
  legal: "Pháp lý / Tuân thủ",
  product: "Sản phẩm",
  ops: "Vận hành",
};

export const KB_STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  active: "Đang dùng",
  superseded: "Đã thay thế",
};

export const KB_PROPOSAL_STATUS_LABEL: Record<string, string> = {
  pending_review: "Chờ duyệt",
  approved: "Đã chấp thuận",
  rejected: "Đã từ chối",
};

export const KB_OPERATION_LABEL: Record<string, string> = {
  create_doc: "Tạo tài liệu mới",
  patch_doc: "Sửa tài liệu đang dùng",
  supersede_doc: "Thay thế tài liệu cũ",
  amend_relation: "Gắn quan hệ sửa đổi",
  replaces_clause: "Thay thế điều khoản",
  noop: "Không đổi",
};

export const MCP_CAPABILITY_LABEL: Record<string, string> = {
  los: "LOS (Hệ thống vay)",
  compliance: "Tuân thủ",
  "core-banking": "Core banking",
  product: "Sản phẩm",
  ops: "Vận hành",
};

export const MCP_IMPL_LABEL: Record<string, string> = {
  real: "Thật",
  stub: "Mô phỏng",
};

export const ON_OFF_LABEL: Record<string, string> = {
  enabled: "Đang bật",
  disabled: "Đã tắt",
};

export const MODE_LABEL: Record<"multi" | "single", string> = {
  multi: "Đa chuyên gia",
  single: "Một chuyên gia",
};

export const AUTOMATION_STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  pending_approval: "Chờ duyệt",
  active: "Đang chạy",
  paused: "Tạm dừng",
  done: "Xong",
  failed: "Lỗi",
  running: "Đang chạy",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "knowledge.publish": "Xuất bản tri thức",
  "knowledge.create_draft": "Tạo bản nháp tri thức",
  "knowledge.ingest.create": "Tạo job nạp tri thức",
  "knowledge.proposal.approve": "Chấp thuận đề xuất tri thức",
  "knowledge.proposal.reject": "Từ chối đề xuất tri thức",
  "approval.approve": "Duyệt yêu cầu",
  "approval.reject": "Từ chối yêu cầu",
  "task_run.create": "Tạo tác vụ",
  "mcp.connector.set_enabled": "Bật/tắt kết nối MCP",
};

export const APPROVAL_REASON_LABEL: Record<string, string> = {
  mutates: "Có tác động hệ thống",
  out_of_portfolio_access: "Ngoài danh mục được giao",
};

export const USAGE_KIND_LABEL: Record<string, string> = {
  llm_plan: "Lập kế hoạch",
  llm_specialist: "Chuyên gia",
  llm_worker: "Worker",
  llm_synthesize: "Tổng hợp",
  rag: "Truy xuất tri thức",
  tool: "Gọi công cụ",
};

export function labelOf(
  map: Record<string, string>,
  key: string | null | undefined,
  fallback?: string,
) {
  if (!key) return fallback ?? "—";
  return map[key] ?? fallback ?? key;
}

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
