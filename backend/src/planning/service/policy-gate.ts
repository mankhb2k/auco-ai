/**
 * Deterministic policy gate — chạy SAU khi có đủ output 3 chuyên gia
 * (Credit/Legal/Collateral), TRƯỚC khi lưu nhãn đề xuất cho nhân viên.
 *
 * Mục đích: nhãn đề xuất cuối cùng không chỉ là LLM "đoán chữ" từ câu trả
 * lời tự do — 1 vài rule cứng (LTV vượt ngưỡng, AML không sạch) sẽ luôn ép
 * kết quả về manual_review/recommend_reject, LLM không thể override.
 * Đây là "rule cứng vs LLM" — LLM chỉ diễn giải, policy gate quyết nhãn.
 */

export type PolicyGateResult = {
  suggestedAssessmentTag:
    | 'recommend_approve'
    | 'manual_review'
    | 'needs_documents'
    | 'recommend_reject';
  /** Rỗng nếu không rule nào bị vi phạm (tag chỉ là suy luận mặc định). */
  reasons: string[];
};

type StepOutput = { id: string; agentRole: string; output: unknown };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function computePolicyGate(stepOutputs: StepOutput[]): PolicyGateResult {
  const byRole = new Map<string, Record<string, unknown>>();
  for (const step of stepOutputs) {
    if (step.output && typeof step.output === 'object') {
      byRole.set(step.agentRole, step.output as Record<string, unknown>);
    }
  }

  const credit = asRecord(byRole.get('credit'));
  const legal = asRecord(byRole.get('legal'));
  const collateral = asRecord(byRole.get('collateral'));

  const reasons: string[] = [];

  // Rule 1 — AML block: từ chối cứng, không đề xuất phê duyệt/rà soát.
  const amlStatus =
    typeof legal.amlStatus === 'string' ? legal.amlStatus : null;
  if (amlStatus === 'block') {
    reasons.push(
      'AML: trạng thái "block" — chính sách yêu cầu từ chối, không thể đề xuất phê duyệt bằng AI.',
    );
    return { suggestedAssessmentTag: 'recommend_reject', reasons };
  }

  // Rule 2 — AML review: luôn rà soát thủ công, chặn recommend_approve.
  if (amlStatus && amlStatus !== 'clear') {
    reasons.push(
      `AML: trạng thái "${amlStatus}" — luôn chuyển rà soát thủ công theo chính sách, AI không thể tự đề xuất phê duyệt.`,
    );
  }

  // Rule 3 — LTV vượt ngưỡng chính sách (Collateral Expert đã tính deterministic).
  const ltvWithinPolicy = collateral.ltvWithinPolicy;
  const ltvActual =
    typeof collateral.ltvActual === 'number' ? collateral.ltvActual : null;
  const policyMaxLtv =
    typeof collateral.policyMaxLtv === 'number'
      ? collateral.policyMaxLtv
      : null;
  if (ltvWithinPolicy === false && ltvActual !== null) {
    reasons.push(
      `LTV thực ${ltvActual}% vượt ngưỡng chính sách ${policyMaxLtv ?? '—'}% — luôn chuyển rà soát thủ công, chặn đề xuất phê duyệt tự động.`,
    );
  }

  if (reasons.length > 0) {
    return { suggestedAssessmentTag: 'manual_review', reasons };
  }

  // Rule 4 — Thiếu hồ sơ TSĐB (chưa có LTV/định giá còn hiệu lực).
  const collateralStatus =
    typeof collateral.status === 'string' ? collateral.status : null;
  const missingData = Array.isArray(collateral.missingData)
    ? (collateral.missingData as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      )
    : [];
  if (collateralStatus === 'needs_info' || missingData.length > 0) {
    return {
      suggestedAssessmentTag: 'needs_documents',
      reasons: missingData.length
        ? [`Tài sản bảo đảm: ${missingData.join('; ')}`]
        : ['Tài sản bảo đảm: chưa đủ dữ liệu để kết luận.'],
    };
  }

  // Rule 5 — Credit Expert đã kết luận không đủ điều kiện sơ bộ.
  if (credit.eligible === false) {
    return {
      suggestedAssessmentTag: 'recommend_reject',
      reasons: [
        'Tín dụng: chưa đạt điều kiện sơ bộ theo dữ liệu CIC/thu nhập.',
      ],
    };
  }

  // Không rule nào bị vi phạm — suy luận mặc định, không phải rule cứng.
  return { suggestedAssessmentTag: 'recommend_approve', reasons: [] };
}
