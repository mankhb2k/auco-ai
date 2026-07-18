import type { TaskPlan } from './task-plan.schema';

export type DemoScenarioId = 'home' | 'corporate' | 'fx' | 'generic';

/** Pinned DAG: Credit ‖ Legal → Product (demo chính §2.4) */
export function buildDemoThreeStepPlan(scenario: DemoScenarioId): TaskPlan {
  const labels =
    scenario === 'corporate'
      ? {
          credit: 'Đánh giá hạn mức / LTV / vốn tự có cho DN SHB Mekong (50 tỷ)',
          legal: 'Đối chiếu Thông tư 39 vs quy trình nội bộ SHB + AML/KYC DN',
          product: 'Đề xuất sản phẩm vay DN / hạn mức phù hợp sau Credit‖Legal',
          summary:
            'DAG demo DN: Credit ‖ Legal → Product (LTV conflict 80%/75%)',
        }
      : scenario === 'fx'
        ? {
            credit: 'Đánh giá rủi ro tín dụng KH Trần Thị Bình (FX/USD)',
            legal: 'AML/KYC + cảnh báo nắm giữ ngoại tệ lớn / tuân thủ',
            product: 'Đề xuất sản phẩm / khuyến nghị mục đích vốn thay vì tích trữ USD',
            summary: 'DAG demo FX: Credit ‖ Legal → Product',
          }
        : {
            credit:
              'Đánh giá khả năng vay mua nhà 2 tỷ — Nguyễn Văn An (SHB-KH-1001)',
            legal: 'Kiểm tra AML/KYC và quy định tuân thủ liên quan khoản vay nhà',
            product: 'Đề xuất sản phẩm vay mua nhà phù hợp nhất',
            summary: 'DAG demo vay nhà: Credit ‖ Legal → Product',
          };

  return {
    summary: labels.summary,
    steps: [
      {
        id: 'step-credit',
        agentRole: 'credit',
        goal: labels.credit,
        dependsOn: [],
        requiredCapabilities: ['loan_eligibility', 'credit_score'],
        mode: 'spawn_workers',
      },
      {
        id: 'step-legal',
        agentRole: 'legal',
        goal: labels.legal,
        dependsOn: [],
        requiredCapabilities: ['aml_check', 'regulation_search'],
        mode: 'direct',
      },
      {
        id: 'step-product',
        agentRole: 'product',
        goal: labels.product,
        dependsOn: ['step-credit', 'step-legal'],
        requiredCapabilities: ['compare_products'],
        mode: 'direct',
      },
    ],
  };
}

export function detectDemoScenario(goal: string): DemoScenarioId {
  const g = goal.toLowerCase();
  if (
    g.includes('50 tỷ') ||
    g.includes('50ty') ||
    g.includes('nhà máy') ||
    g.includes('thông tư 39') ||
    g.includes('mekong') ||
    g.includes('doanh nghiệp') ||
    g.includes('công ty')
  ) {
    return 'corporate';
  }
  if (
    g.includes('usd') ||
    g.includes('ngoại tệ') ||
    g.includes('imf') ||
    g.includes('chuyển đổi') ||
    g.includes('fx')
  ) {
    return 'fx';
  }
  if (
    g.includes('mua nhà') ||
    g.includes('nguyễn văn an') ||
    g.includes('shb-kh-1001') ||
    g.includes('2 tỷ')
  ) {
    return 'home';
  }
  // Default pin home-style 3-step when goal looks like multi-domain loan ask
  if (
    (g.includes('vay') || g.includes('tín dụng')) &&
    (g.includes('aml') ||
      g.includes('tuân thủ') ||
      g.includes('sản phẩm') ||
      g.includes('điều kiện'))
  ) {
    return 'home';
  }
  return 'generic';
}
