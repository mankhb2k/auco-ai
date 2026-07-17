import type { BlockGroup, BlockStatus } from "@/lib/workflowMockGraphs";

export type { BlockGroup, BlockStatus };

export const BLOCK_GROUP_META: Record<
  BlockGroup,
  {
    label: string;
    /** Nền ô icon (solid, phong cách reference) */
    iconBg: string;
  }
> = {
  trigger: {
    label: "Trigger Node",
    iconBg: "bg-[#7C4DFF]",
  },
  extraction: {
    label: "Extraction Node",
    iconBg: "bg-[#0D9488]",
  },
  processing: {
    label: "Processing Node",
    iconBg: "bg-[#0EA5E9]",
  },
  action: {
    label: "Action Node",
    iconBg: "bg-[#F59E0B]",
  },
  control: {
    label: "Control Node",
    iconBg: "bg-[#F43F5E]",
  },
};

export const BLOCK_STATUS_LABEL: Record<BlockStatus, string> = {
  idle: "Sẵn sàng",
  running: "Đang xử lý...",
  success: "Sẵn sàng",
  failed: "Lỗi",
};

export const BLOCK_STATUS_DOT: Record<BlockStatus, string> = {
  idle: "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  success: "bg-emerald-500",
  failed: "bg-rose-500",
};

/** Kích thước chuẩn để dagre / canvas căn layout */
export const BLOCK_SIZE = {
  width: 240,
  height: 72,
} as const;
