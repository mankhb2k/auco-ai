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
    name: "Tự động đăng bài Facebook Q1",
    trigger: "Hàng ngày lúc 14:00",
    diagram: {
      nodes: [
        {
          id: "n1",
          blockId: "trigger.cron",
          group: "trigger",
          displayName: "Trigger Lịch Giờ",
          shortSummary: "Kích hoạt định kỳ 14:00 hàng ngày",
          icon: "🕗",
          status: "success",
          enabled: true,
        },
        {
          id: "n2",
          blockId: "process.llm-transform",
          group: "processing",
          displayName: "Content Creator AI",
          shortSummary: "Soạn thảo bài đăng PR theo template sản phẩm",
          icon: "📝",
          status: "success",
          enabled: true,
        },
        {
          id: "n3",
          blockId: "action.social-publish",
          group: "action",
          displayName: "Publisher AI",
          shortSummary: "Lên lịch và tự động đăng bài lên Fanpage qua Graph API",
          icon: "✈️",
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
        detail: "Đã đăng thành công bài PR: 'Bí mật x10 hiệu suất...'",
      },
      {
        id: "#wf1-101",
        time: "Hôm qua, 14:00",
        status: "success",
        detail: "Đã đăng thành công bài PR: 'Làm chủ AI ngay...'",
      },
    ],
  },
  wf_2: {
    name: "Quét tin nhắn Page & Báo cáo",
    trigger: "Khi có tin nhắn mới",
    diagram: {
      nodes: [
        {
          id: "n1",
          blockId: "trigger.webhook",
          group: "trigger",
          displayName: "Tin nhắn mới",
          shortSummary: "Webhook phát hiện tin nhắn mới trên Fanpage",
          icon: "✉️",
          status: "running",
          enabled: true,
        },
        {
          id: "n2",
          blockId: "process.llm-transform",
          group: "processing",
          displayName: "Phân loại ý định",
          shortSummary: "AI đọc tin nhắn và xếp loại câu hỏi / khiếu nại",
          icon: "🧠",
          status: "success",
          enabled: true,
        },
        {
          id: "n3",
          blockId: "process.filter-condition",
          group: "control",
          displayName: "If / Else",
          shortSummary: "Tin nhắn có thể tự trả lời được không?",
          icon: "◇",
          status: "success",
          enabled: true,
        },
        {
          id: "n4a",
          blockId: "action.notification",
          group: "action",
          displayName: "Trả lời tự động",
          shortSummary: "Gửi phản hồi mẫu vào Page inbox",
          icon: "💬",
          status: "success",
          enabled: true,
        },
        {
          id: "n4b",
          blockId: "action.notification",
          group: "action",
          displayName: "Báo sếp duyệt",
          shortSummary: "Đẩy cảnh báo về Telegram khi cần người xử lý",
          icon: "🔔",
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
        detail: "Đang xử lý tin nhắn từ khách hàng: Nguyễn Văn A...",
      },
      {
        id: "#wf2-997",
        time: "5 phút trước",
        status: "success",
        detail: "Nhánh 'Có' — đã trả lời tự động và ghi nhận vào báo cáo.",
      },
    ],
  },
  wf_3: {
    name: "Sync Affiliate Clip sang TikTok",
    trigger: "Mỗi thứ Hai lúc 08:00",
    diagram: {
      nodes: [
        {
          id: "n1",
          blockId: "trigger.cron",
          group: "trigger",
          displayName: "Trigger Lịch Giờ",
          shortSummary: "Kích hoạt mỗi thứ Hai lúc 08:00",
          icon: "🕗",
          status: "success",
          enabled: true,
        },
        {
          id: "n2",
          blockId: "extract.http-fetch",
          group: "extraction",
          displayName: "Google Drive Node",
          shortSummary: "Tải video review sản phẩm mới nhất từ Drive",
          icon: "💾",
          status: "success",
          enabled: true,
        },
        {
          id: "n3",
          blockId: "action.social-publish",
          group: "action",
          displayName: "Publisher AI",
          shortSummary: "Đăng tải video lên kênh TikTok Shop Affiliate",
          icon: "🎥",
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
        detail: "Đã đồng bộ và đăng video 'Review Gậy Selfie AI' thành công.",
      },
    ],
  },
  wf_4: {
    name: "Theo dõi giá đối thủ & Cảnh báo",
    trigger: "Hàng giờ",
    diagram: {
      nodes: [
        {
          id: "n1",
          blockId: "trigger.cron",
          group: "trigger",
          displayName: "Trigger Lịch Giờ",
          shortSummary: "Kích hoạt lặp lại mỗi 1 giờ",
          icon: "⏰",
          status: "success",
          enabled: true,
        },
        {
          id: "n2",
          blockId: "process.llm-transform",
          group: "processing",
          displayName: "Research AI",
          shortSummary: "Quét giá sản phẩm trên các sàn Shopee/Lazada",
          icon: "🔍",
          status: "success",
          enabled: true,
        },
        {
          id: "n3",
          blockId: "action.notification",
          group: "action",
          displayName: "Slack/Telegram Node",
          shortSummary: "Gửi báo cáo so sánh giá và cảnh báo nếu đối thủ hạ giá",
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
        detail: "Đã quét thành công. Không phát hiện biến động giá bất thường.",
      },
      {
        id: "#wf4-2450",
        time: "1 giờ trước",
        status: "success",
        detail: "Đã quét thành công. Không phát hiện biến động giá bất thường.",
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
