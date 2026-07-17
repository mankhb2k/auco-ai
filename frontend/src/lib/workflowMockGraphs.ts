export type BlockGroup =
  | "trigger"
  | "extraction"
  | "processing"
  | "action"
  | "control";

export type BlockStatus = "idle" | "running" | "success" | "failed";

export interface DiagramNode {
  id: string;
  blockId: string;
  group: BlockGroup;
  displayName: string;
  shortSummary: string;
  icon?: string;
  status?: BlockStatus;
  enabled?: boolean;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** Handle id trên node nguồn (vd. 'yes' | 'no' cho If/Else) */
  sourceHandle?: string;
}

export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface WorkflowLog {
  id: string;
  time: string;
  status: "success" | "running" | "failed";
  detail: string;
}

export interface WorkflowConfig {
  name: string;
  trigger: string;
  diagram: DiagramData;
  logs: WorkflowLog[];
}

const graphs: Record<string, WorkflowConfig> = {
  wf_1: {
    name: "Thẩm định hồ sơ doanh nghiệp Q1",
    trigger: "Khi nhận hồ sơ mới từ LOS",
    diagram: {
      nodes: [
        {
          id: "n1",
          blockId: "trigger.cron",
          group: "trigger",
          displayName: "Nhận Hồ Sơ",
          shortSummary: "Kích hoạt khi nhận hồ sơ vay mới",
          icon: "📥",
          status: "success",
          enabled: true,
        },
        {
          id: "n2",
          blockId: "process.llm-transform",
          group: "processing",
          displayName: "Planner Agent",
          shortSummary: "Kiểm tra tính đầy đủ pháp lý/tài chính ban đầu",
          icon: "📋",
          status: "success",
          enabled: true,
        },
        {
          id: "n3",
          blockId: "action.social-publish",
          group: "action",
          displayName: "Credit Agent",
          shortSummary: "Thẩm định tài chính doanh nghiệp và xếp hạng tín dụng",
          icon: "💳",
          status: "success",
          enabled: true,
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
    },
    logs: [
      {
        id: "#wf1-102",
        time: "Hôm nay, 14:00",
        status: "success",
        detail: "Đã hoàn tất thẩm định Công ty Thép Việt: Hạng A-, đề xuất hạn mức 50 tỷ.",
      },
      {
        id: "#wf1-101",
        time: "Hôm qua, 14:00",
        status: "success",
        detail: "Đã hoàn tất thẩm định Công ty Xi măng HP: Hạng BBB, đề xuất hạn mức 30 tỷ.",
      },
    ],
  },
  wf_2: {
    name: "Phê duyệt khoản vay tiêu dùng",
    trigger: "Khi khách hàng nộp hồ sơ trực tuyến",
    diagram: {
      nodes: [
        {
          id: "n1",
          blockId: "trigger.webhook",
          group: "trigger",
          displayName: "Hồ sơ trực tuyến",
          shortSummary: "Phát hiện đơn đề nghị vay tiêu dùng mới trực tuyến",
          icon: "🚗",
          status: "running",
          enabled: true,
        },
        {
          id: "n2",
          blockId: "process.llm-transform",
          group: "processing",
          displayName: "Tra cứu CIC",
          shortSummary: "AI đọc hồ sơ và tra cứu lịch sử tín dụng CIC khách hàng",
          icon: "🔍",
          status: "success",
          enabled: true,
        },
        {
          id: "n3",
          blockId: "process.filter-condition",
          group: "control",
          displayName: "If / Else",
          shortSummary: "Lịch sử tín dụng tốt và không có nợ quá hạn?",
          icon: "◇",
          status: "success",
          enabled: true,
        },
        {
          id: "n4a",
          blockId: "action.notification",
          group: "action",
          displayName: "Duyệt sơ bộ",
          shortSummary: "Đồng ý gói vay ưu đãi và chuyển Product Agent",
          icon: "📦",
          status: "success",
          enabled: true,
        },
        {
          id: "n4b",
          blockId: "action.notification",
          group: "action",
          displayName: "Từ chối vay",
          shortSummary: "Gửi email thông báo từ chối do lịch sử nợ xấu",
          icon: "❌",
          status: "success",
          enabled: true,
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3a", source: "n3", target: "n4a", label: "Có", sourceHandle: "yes" },
        { id: "e3b", source: "n3", target: "n4b", label: "Không", sourceHandle: "no" },
      ],
    },
    logs: [
      {
        id: "#wf2-998",
        time: "Vừa xong",
        status: "running",
        detail: "Đang kiểm tra lịch sử CIC khách hàng Nguyễn Văn A...",
      },
      {
        id: "#wf2-997",
        time: "5 phút trước",
        status: "success",
        detail: "Nhánh 'Có' — Khách hàng Nguyễn Văn A đủ điều kiện định danh eKYC.",
      },
    ],
  },
  wf_3: {
    name: "Kiểm tra tuân thủ pháp lý",
    trigger: "Mỗi khi hoàn tất thẩm định tài chính",
    diagram: {
      nodes: [
        {
          id: "n1",
          blockId: "trigger.cron",
          group: "trigger",
          displayName: "Kết quả tài chính",
          shortSummary: "Nhận kết quả thẩm định hạn mức vay từ Credit Agent",
          icon: "📥",
          status: "success",
          enabled: true,
        },
        {
          id: "n2",
          blockId: "extract.http-fetch",
          group: "extraction",
          displayName: "Google Drive Node",
          shortSummary: "Tải các văn bản pháp lý tài sản thế chấp từ Drive",
          icon: "💾",
          status: "success",
          enabled: true,
        },
        {
          id: "n3",
          blockId: "action.social-publish",
          group: "action",
          displayName: "Legal Agent",
          shortSummary: "Đối chiếu tài sản bảo đảm với quy chuẩn an toàn SHB",
          icon: "⚖️",
          status: "success",
          enabled: true,
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
    },
    logs: [
      {
        id: "#wf3-042",
        time: "Hôm qua, 08:00",
        status: "success",
        detail: "Đã phê duyệt pháp lý tài sản thế chấp nhà xưởng Thép Việt.",
      },
    ],
  },
  wf_4: {
    name: "Giám sát rủi ro sau giải ngân",
    trigger: "Hàng tháng vào ngày 25",
    diagram: {
      nodes: [
        {
          id: "n1",
          blockId: "trigger.cron",
          group: "trigger",
          displayName: "Lịch quét định kỳ",
          shortSummary: "Kích hoạt lặp lại mỗi tháng",
          icon: "⏰",
          status: "success",
          enabled: true,
        },
        {
          id: "n2",
          blockId: "process.llm-transform",
          group: "processing",
          displayName: "Operations Agent",
          shortSummary: "Quét tình hình dư nợ và đối chiếu hạn thanh toán",
          icon: "⚙️",
          status: "success",
          enabled: true,
        },
        {
          id: "n3",
          blockId: "action.notification",
          group: "action",
          displayName: "Tạo phiếu nhắc việc",
          shortSummary: "Gửi nhắc nhở kiểm tra sử dụng vốn sau giải ngân",
          icon: "🔔",
          status: "success",
          enabled: true,
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
    },
    logs: [
      {
        id: "#wf4-2451",
        time: "12 phút trước",
        status: "success",
        detail: "Đã chạy đối chiếu. Không có dư nợ xấu phát sinh.",
      },
      {
        id: "#wf4-2450",
        time: "1 giờ trước",
        status: "success",
        detail: "Đã chạy đối chiếu. Không có dư nợ xấu phát sinh.",
      },
    ],
  },
};

export function getWorkflowConfig(workflowId: string): WorkflowConfig {
  return (
    graphs[workflowId] ?? {
      name: "Workflow Không Tên",
      trigger: "Manual",
      diagram: { nodes: [], edges: [] },
      logs: [],
    }
  );
}
