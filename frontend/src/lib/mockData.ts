import type { Chat } from "@/types/chat";

export const initialChats: Chat[] = [
  // --- WORKFLOW CHATS ---
  {
    id: "wf_1",
    name: "Thẩm định hồ sơ doanh nghiệp Q1 📊",
    status: "idle",
    avatarText: "WF",
    avatarBg: "bg-avatar-blue",
    notifications: true,
    category: "workflow",
    description: "Tự động phân tích báo cáo tài chính, thẩm định dòng tiền và đề xuất hạn mức tín dụng.",
    trigger: "Khi nhận hồ sơ mới từ LOS",
    lastRun: "10 phút trước",
    messages: [
      {
        id: "wfm1_1",
        sender: "them",
        text: "Chào chuyên viên! Em là Trợ Lý Điều Phối. Em đã dựng quy trình tự động thẩm định tín dụng doanh nghiệp Q1 theo chính sách SHB. Sếp xem sơ đồ chi tiết bên dưới nhé.",
        time: "10:00",
        read: true
      },
      {
        id: "wfm1_2",
        sender: "them",
        text: "[WORKFLOW_PREVIEW] Em đã dựng xong sơ đồ xử lý:\nNhận Hồ Sơ -> Planner Agent -> Credit Agent -> Legal Agent.\nSếp xem chi tiết bên dưới nhé.",
        time: "10:01",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "wf_2",
    name: "Phê duyệt khoản vay tiêu dùng 🚗",
    status: "running",
    avatarText: "WF",
    avatarBg: "bg-avatar-green",
    notifications: true,
    category: "workflow",
    description: "Quét điểm tín dụng CIC, tự động kiểm tra điều kiện thu nhập và ra quyết định sơ bộ.",
    trigger: "Khi khách hàng nộp hồ sơ trực tuyến",
    lastRun: "Đang chạy...",
    messages: [
      {
        id: "wfm2_1",
        sender: "them",
        text: "Chào chuyên viên! Em đang theo dõi cổng hồ sơ vay tiêu dùng trực tuyến. Khi có hồ sơ mới, em sẽ kích hoạt Planner Agent để phân tích ban đầu.",
        time: "Yesterday",
        read: true
      },
      {
        id: "wfm2_2",
        sender: "them",
        text: "[WORKFLOW_PREVIEW] Em đã dựng xong sơ đồ kiểm tra điều kiện:\nHồ sơ mới → Tra cứu CIC → If/Else → (Đủ điều kiện) Chuyển Credit Agent | (Không) Báo trả hồ sơ.\nSếp xem chi tiết bên dưới nhé.",
        time: "Yesterday",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "wf_3",
    name: "Kiểm tra tuân thủ pháp lý 📜",
    status: "success",
    avatarText: "WF",
    avatarBg: "bg-avatar-orange",
    notifications: true,
    category: "workflow",
    description: "Đối chiếu hồ sơ thế chấp với các văn bản quy định hiện hành của Ngân hàng Nhà nước.",
    trigger: "Mỗi khi hoàn tất thẩm định tài chính",
    lastRun: "2 giờ trước",
    messages: [
      {
        id: "wfm3_1",
        sender: "them",
        text: "Chào chuyên viên! Quy trình đối chiếu tuân thủ pháp lý tài sản bảo đảm đang hoạt động ổn định.",
        time: "Jul 13",
        read: true
      },
      {
        id: "wfm3_2",
        sender: "them",
        text: "[WORKFLOW_PREVIEW] Em đã dựng xong sơ đồ kiểm tra pháp lý:\nThẩm định xong -> Legal & Compliance Agent -> Trình Ban phê duyệt.\nSếp xem chi tiết bên dưới nhé.",
        time: "Jul 13",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "wf_4",
    name: "Giám sát rủi ro sau giải ngân 🚨",
    status: "success",
    avatarText: "WF",
    avatarBg: "bg-avatar-purple",
    notifications: true,
    category: "workflow",
    description: "Theo dõi tình hình dư nợ, cảnh báo kỳ trả nợ và nhắc nhở chuyên viên kiểm tra sau vay.",
    trigger: "Hàng tháng vào ngày 25",
    lastRun: "Hôm qua lúc 18:00",
    messages: [
      {
        id: "wfm4_1",
        sender: "them",
        text: "Chào chuyên viên! Tôi đang quét danh sách các khoản vay giải ngân trong tháng để lập lịch kiểm tra mục đích sử dụng vốn.",
        time: "Jul 12",
        read: true
      },
      {
        id: "wfm4_2",
        sender: "them",
        text: "[WORKFLOW_PREVIEW] Em đã dựng xong sơ đồ giám sát:\nĐến kỳ kiểm tra -> Operations Agent -> Tạo phiếu nhắc việc chuyên viên.\nSếp xem chi tiết bên dưới nhé.",
        time: "Jul 12",
        read: true
      }
    ],
    sharedMedia: []
  },
  // --- TIN NHẮN (ROOMS & SESSIONS) ---
  {
    id: "room_marketing",
    name: "Ban Thẩm Định Tín Dụng Q1 🏦",
    status: "5 agents active",
    avatarText: "B",
    avatarBg: "bg-avatar-blue",
    notifications: true,
    category: "chat",
    messages: [
      {
        id: "rm1",
        sender: "them",
        text: "Hệ thống: Ban Thẩm Định Tín Dụng Doanh Nghiệp Q1 đã khởi tạo thành công.",
        time: "10:00",
        read: true
      },
      {
        id: "rm2",
        sender: "them",
        text: "Planner Agent: Chào chuyên viên, em đã tiếp nhận hồ sơ vay của Công ty Cổ phần Thép Việt và sẵn sàng phân tích hồ sơ ban đầu.",
        time: "10:02",
        read: true
      },
      {
        id: "rm3",
        sender: "them",
        text: "Credit Agent: Em vừa hoàn tất chạy mô hình xếp hạng tín dụng nội bộ. Khách hàng đạt hạng A-, đề xuất hạn mức vay 50 tỷ đồng. Sếp duyệt đề xuất xếp hạng giúp em nhé!",
        time: "10:15",
        read: true
      },
      {
        id: "rm4",
        sender: "me",
        text: "Duyệt em nhé. Kết quả xếp hạng hợp lý! Hãy chuyển Legal Agent kiểm tra tính pháp lý tài sản thế chấp.",
        time: "10:20",
        read: true
      },
      {
        id: "rm5",
        sender: "them",
        text: "Trợ Lý: @Credit Agent Đã duyệt báo cáo tài chính. @Legal & Compliance Agent Bắt đầu rà soát hồ sơ thế chấp nhà xưởng.",
        time: "10:21",
        read: true
      },
      {
        id: "rm6",
        sender: "them",
        text: "Legal & Compliance Agent: Báo cáo sếp, tài sản thế chấp hợp lệ, không có tranh chấp quy hoạch. Hồ sơ đủ điều kiện pháp lý giải ngân. ✅",
        time: "10:25",
        read: true
      },
      {
        id: "rm7",
        sender: "me",
        text: "@Trợ Lý Dự thảo tờ trình phê duyệt khoản vay, lãi suất ưu đãi 6.5%/năm",
        time: "13:42",
        read: true
      },
      {
        id: "rm8",
        sender: "them",
        text: "Trợ Lý:\n\nTờ trình phê duyệt:\n\nĐề xuất cấp hạn mức 50 tỷ đồng – Lãi suất 6.5%/năm – Thời hạn 12 tháng… 🧧\n\nXem chi tiết tờ trình tại bảng bên phải sau khi bạn duyệt giúp em nhé!",
        time: "13:50",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "room_tiktok",
    name: "Duyệt Vay Tiêu Dùng SHB 🚗",
    status: "3 agents active",
    avatarText: "V",
    avatarBg: "bg-avatar-orange",
    notifications: true,
    category: "chat",
    messages: [
      {
        id: "rt1",
        sender: "them",
        text: "Hệ thống: Khởi tạo phòng xử lý vay tiêu dùng cá nhân trực tuyến.",
        time: "Yesterday",
        read: true
      },
      {
        id: "rt2",
        sender: "them",
        text: "Planner Agent: Em đã tự động đối chiếu thông tin định danh eKYC của khách hàng Nguyễn Văn A, kết quả khớp 100%.",
        time: "Yesterday",
        read: true
      },
      {
        id: "rt3",
        sender: "them",
        text: "Product Agent: Khách hàng vay mua ô tô, gói sản phẩm áp dụng: Vay mua xe ưu đãi SHB 2026. Lãi suất đề xuất 7.2%/năm.",
        time: "Yesterday",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "session_translate",
    name: "Tra cứu CIC nhanh 🔍",
    status: "Quick Assistant",
    avatarText: "CC",
    avatarBg: "bg-avatar-pink",
    notifications: false,
    category: "chat",
    messages: [
      {
        id: "st1",
        sender: "me",
        text: "Tra cứu thông tin tín dụng CIC khách hàng Lê Văn B, CCCD số 012345678901",
        time: "09:30",
        read: true
      },
      {
        id: "st2",
        sender: "them",
        text: "Quick Assistant: Khách hàng Lê Văn B, CCCD 012345678901. Lịch sử tín dụng: Nhóm 1 (Tốt), tổng dư nợ hiện tại 150 triệu đồng tại 2 TCTD. Không có nợ xấu.",
        time: "09:31",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "session_copywriting",
    name: "Hỏi đáp chính sách SHB 📖",
    status: "Quick Assistant",
    avatarText: "CS",
    avatarBg: "bg-avatar-green",
    notifications: false,
    category: "chat",
    messages: [
      {
        id: "sc1",
        sender: "me",
        text: "Hạn mức cho vay tối đa đối với sản phẩm Vay mua nhà dự án là bao nhiêu?",
        time: "Friday",
        read: true
      },
      {
        id: "sc2",
        sender: "them",
        text: "Quick Assistant:\nTheo quy định hiện hành của SHB:\n1. Tỷ lệ cho vay tối đa lên tới 85% giá trị tài sản bảo đảm.\n2. Thời hạn vay tối đa lên tới 25 năm.\n3. Tài sản bảo đảm có thể là chính căn hộ/nhà đất dự án định mua hoặc tài sản độc lập khác.",
        time: "Friday",
        read: true
      }
    ],
    sharedMedia: []
  },

  // --- AGENT TAB DMs ---
  {
    id: "mother",
    name: "AucoMother",
    status: "online",
    avatarText: "AM",
    avatarBg: "bg-avatar-purple",
    notifications: true,
    category: "agent",
    pinned: true,
    verified: true,
    description: "Hệ thống điều phối các chuyên gia nghiệp vụ ngân hàng SHB. Giúp khởi tạo, liên kết quy trình và giám sát các tác tử tín dụng, pháp lý, sản phẩm.",
    messages: [
      {
        id: "mth1",
        sender: "them",
        text: "Chào chuyên viên! Em là AucoMother - Trợ lý điều phối ngân hàng SHB. Em chịu trách nhiệm khởi tạo, cấu hình và phân phối hồ sơ cho các Agent nghiệp vụ tín dụng. Sếp có muốn thiết lập luồng thẩm định hồ sơ mới nào không?",
        time: "13:38",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "agent_content",
    name: "Planner Agent 📋",
    status: "last seen recently",
    avatarText: "PL",
    avatarBg: "bg-avatar-pink",
    notifications: false,
    category: "agent",
    description: "Lập kế hoạch thẩm định, phân tích hồ sơ ban đầu và điều phối luồng xử lý tín dụng.",
    messages: [
      {
        id: "ac1",
        sender: "them",
        text: "Planner Agent: Chào sếp, em phụ trách tiếp nhận hồ sơ, kiểm tra tính đầy đủ của giấy tờ pháp lý/tài chính ban đầu và lập kế hoạch rà soát chi tiết cho các Agent tiếp theo.",
        time: "11:22",
        read: true
      },
      {
        id: "ac2",
        sender: "me",
        text: "Khách hàng nộp hồ sơ vay doanh nghiệp cần những tài liệu cốt lõi nào?",
        time: "13:45",
        read: true
      },
      {
        id: "ac3",
        sender: "them",
        text: "Planner Agent:\n\nDanh mục tài liệu cốt lõi cần thu thập:\n1. Hồ sơ pháp lý: ĐKKD, Điều lệ, Nghị quyết bổ nhiệm người đại diện pháp luật.\n2. Hồ sơ tài chính: Báo cáo tài chính 2 năm gần nhất, Tờ khai thuế VAT, Sổ chi tiết công nợ.\n3. Hồ sơ phương án vay: Hợp đồng đầu vào/đầu ra chứng minh phương án sử dụng vốn.\n\nSếp cần em lập check-list chi tiết gửi khách hàng không?",
        time: "13:48",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "agent_designer",
    name: "Credit Agent 💳",
    status: "last seen recently",
    avatarText: "CR",
    avatarBg: "bg-avatar-blue",
    notifications: false,
    category: "agent",
    description: "Thực hiện thẩm định tài chính, phân tích dòng tiền, đánh giá khả năng trả nợ và đề xuất hạn mức tín dụng.",
    messages: [
      {
        id: "ad1",
        sender: "them",
        text: "Credit Agent: Em chuyên phân tích khả năng tài chính của doanh nghiệp và cá nhân, tính toán các chỉ số tài chính (DSCR, Leverage, EBITDA) và đưa ra mức tín dụng an toàn đề xuất.",
        time: "10:15",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "agent_research",
    name: "Legal & Compliance Agent ⚖️",
    status: "online",
    avatarText: "LE",
    avatarBg: "bg-avatar-green",
    notifications: false,
    category: "agent",
    description: "Kiểm tra tính pháp lý của hồ sơ khách hàng, đối chiếu quy định nội bộ SHB và quy định pháp luật của NHNN.",
    messages: [
      {
        id: "ar1",
        sender: "them",
        text: "Legal & Compliance Agent: Em rà soát tính hợp pháp của tài sản thế chấp, tư cách pháp lý của bên vay/bên bảo lãnh và đảm bảo mọi quy trình tuân thủ đúng Luật các Tổ chức tín dụng.",
        time: "Yesterday",
        read: true
      }
    ],
    sharedMedia: []
  },
  {
    id: "agent_publisher",
    name: "Product Agent 📦",
    status: "last seen recently",
    avatarText: "PR",
    avatarBg: "bg-avatar-orange",
    notifications: false,
    category: "agent",
    description: "Đề xuất cấu trúc gói sản phẩm vay phù hợp, áp dụng biểu lãi suất ưu đãi và các điều kiện đi kèm.",
    messages: [
      {
        id: "ap1",
        sender: "them",
        text: "Product Agent: Em hỗ trợ đề xuất các gói sản phẩm của SHB (như tài trợ xích đu, thấu chi doanh nghiệp, vay mua ô tô ưu đãi) kèm theo các điều kiện giải ngân và quản lý rủi ro.",
        time: "Jul 12",
        read: true
      }
    ],
    sharedMedia: []
  }
];

export const initialWorkflows = initialChats.filter(c => c.category === "workflow");
