/**
 * §5.4 mở rộng — purpose → modelTier (small/mid/large).
 *
 * App code chỉ khai báo purpose; gateway quyết định tier + model.
 * Nhân viên/agent không tự chọn model (giữ nguyên nguyên tắc B).
 */

export type ModelTier = 'small' | 'mid' | 'large';

/**
 * Map purpose → tier. Purpose lạ rơi về DEFAULT_TIER (mid) —
 * an toàn hơn là mặc định model lớn.
 */
const PURPOSE_TIER_MAP: Record<string, ModelTier> = {
  // large — lập kế hoạch đa bước, tổng hợp đa chuyên gia, suy luận pháp lý
  task_plan: 'large',
  synthesize: 'large',
  conflict_resolution: 'large',

  // mid — specialist 1 domain, đề xuất tri thức, transform automation
  specialist: 'mid',
  knowledge_ingest_propose: 'mid',
  automation_transform: 'mid',

  // small — extract/classify/format/gom JSON, health-check
  extract: 'small',
  classify: 'small',
  chunk_summary: 'small',
  worker_aggregate: 'small',
  smoke: 'small',
};

export const DEFAULT_TIER: ModelTier = 'mid';

export function tierForPurpose(purpose?: string): ModelTier {
  if (!purpose) return DEFAULT_TIER;
  return PURPOSE_TIER_MAP[purpose] ?? DEFAULT_TIER;
}

export function knownPurposes(): Record<string, ModelTier> {
  return { ...PURPOSE_TIER_MAP };
}
