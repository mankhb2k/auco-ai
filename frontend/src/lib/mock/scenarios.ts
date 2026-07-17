import type { ScenarioId } from "@/lib/types/domain";

export interface ScenarioPreset {
  id: ScenarioId;
  title: string;
  shortLabel: string;
  goal: string;
  description: string;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "corporate",
    title: "Vay DN 50 tỷ + Thông tư 39",
    shortLabel: "DN 50 tỷ",
    description: "Credit ‖ Legal → Product · LTV conflict 80%/75% · hạn mức ~40 tỷ",
    goal:
      "Phân tích hồ sơ vay của Công ty TNHH Sản xuất SHB Mekong (SHB-KH-1002), khoản vay 50 tỷ, mục đích mở rộng nhà máy. Cho biết hạn mức tối đa theo quy định hiện tại, có mâu thuẫn với Thông tư 39/2016/TT-NHNN không? Nếu đủ điều kiện thì chuẩn bị tạo hồ sơ và giải ngân.",
  },
  {
    id: "fx",
    title: "Cảnh báo FX / IMF",
    shortLabel: "FX · IMF",
    description: "KH muốn vay/đổi ngoại tệ lớn · macro IMF · khuyến nghị mục đích vốn",
    goal:
      "Khách hàng Trần Thị Bình (SHB-KH-1003) muốn vay và chuyển đổi một khoản lớn sang USD để tích trữ. Kiểm tra rủi ro tín dụng, đối chiếu xu hướng nắm giữ ngoại tệ hộ gia đình (IMF), và đưa khuyến nghị trước khi duyệt.",
  },
  {
    id: "home",
    title: "Vay mua nhà cá nhân",
    shortLabel: "Vay nhà",
    description: "Case retail — Nguyễn Văn An · DAG 3 chuyên gia",
    goal:
      "Khách hàng Nguyễn Văn An (SHB-KH-1001) muốn vay 2 tỷ mua nhà, kiểm tra đủ điều kiện tín dụng không, có vướng quy định AML/tuân thủ không, sản phẩm vay nào phù hợp nhất, và tạo hồ sơ vận hành nếu đủ điều kiện.",
  },
];

export function detectScenario(goal: string): ScenarioId {
  const g = goal.toLowerCase();
  if (
    g.includes("50 tỷ") ||
    g.includes("50ty") ||
    g.includes("nhà máy") ||
    g.includes("thông tư 39") ||
    g.includes("mekong") ||
    g.includes("doanh nghiệp") ||
    g.includes("công ty")
  ) {
    return "corporate";
  }
  if (
    g.includes("usd") ||
    g.includes("ngoại tệ") ||
    g.includes("imf") ||
    g.includes("chuyển đổi") ||
    g.includes("fx")
  ) {
    return "fx";
  }
  return "home";
}

export const DEFAULT_SCENARIO: ScenarioId = "corporate";
