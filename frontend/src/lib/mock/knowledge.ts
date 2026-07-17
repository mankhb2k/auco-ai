import type { KnowledgeDocument } from "@/lib/types/domain";

/** RAG lite mock — versioning + amends/supersedes, không Graph DB. */
export const knowledgeDocuments: KnowledgeDocument[] = [
  {
    id: "doc-tt39",
    title: "Thông tư 39/2016/TT-NHNN",
    section: "Điều kiện tài sản bảo đảm · LTV",
    content:
      "Tỷ lệ cho vay tối đa trên giá trị tài sản bảo đảm (LTV) đối với bất động sản sản xuất kinh doanh có thể lên tới 80%.",
    effectiveFrom: "2016-12-30",
    effectiveTo: null,
    status: "active",
    ltvMaxPct: 80,
  },
  {
    id: "doc-shb-td-v1",
    title: "SHB Quy trình tín dụng nội bộ",
    section: "5.2 LTV nhà xưởng",
    content: "LTV tối đa với nhà xưởng/TSĐB sản xuất: 70%.",
    effectiveFrom: "2022-01-01",
    effectiveTo: "2024-12-31",
    status: "superseded",
    ltvMaxPct: 70,
  },
  {
    id: "doc-shb-td-v2",
    title: "SHB Quy trình tín dụng nội bộ",
    section: "5.2 LTV nhà xưởng (sửa đổi)",
    content:
      "LTV tối đa với nhà xưởng: 75% — khắt hơn Thông tư 39 (80%). Đây là hạn chế bổ sung nội bộ, vẫn hợp lệ.",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    status: "active",
    relation: { type: "amends", targetId: "doc-shb-td-v1" },
    ltvMaxPct: 75,
  },
  {
    id: "doc-shb-dti",
    title: "SHB Chính sách phân hạng rủi ro tín dụng",
    section: "3.1 Ngưỡng DTI / CIC",
    content: "DTI cá nhân ≤ 60%. Nhóm nợ CIC 1–2 ưu tiên; nhóm 3 cần phê duyệt đặc biệt.",
    effectiveFrom: "2024-06-01",
    effectiveTo: null,
    status: "active",
  },
  {
    id: "doc-aml",
    title: "SBV-4889 AML / KYC",
    section: "Điều 8 — Nhận biết khách hàng",
    content: "Yêu cầu KYC đầy đủ trước khi cấp tín dụng / giao dịch ngoại tệ lớn.",
    effectiveFrom: "2023-01-01",
    effectiveTo: null,
    status: "active",
  },
];

export const ltvConflict = {
  severity: "medium" as const,
  circularPct: 80,
  internalPct: 75,
  message:
    "Mâu thuẫn mức trung bình: Thông tư 39 cho phép LTV 80%, quy trình nội bộ SHB chỉ 75% → hạn chế bổ sung, cần phê duyệt đặc biệt / hội đồng tín dụng.",
};
