import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../../llm/llm.gateway';
import { catalogPromptBlock } from '../../agents/agent-catalog';
import {
  buildDemoLoanAssessmentPlan,
  detectDemoScenario,
} from '../demo-plans';
import { validateTaskPlan } from '../plan-validator';
import { TaskPlanSchema, type TaskPlan } from '../task-plan.schema';

export type CreatePlanResult = {
  plan: TaskPlan;
  source: 'demo_pinned' | 'llm';
  scenario: string;
  validationErrors?: string[];
};

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(private readonly llm: LlmGatewayService) {}

  async createPlan(goal: string): Promise<CreatePlanResult> {
    const scenario = detectDemoScenario(goal);

    // Demo cases: pin Credit ‖ Legal ‖ Collateral → Product.
    if (scenario !== 'generic') {
      const plan = buildDemoLoanAssessmentPlan(scenario);
      const validated = validateTaskPlan(plan, { demoPinned: true });
      if (!validated.ok) {
        throw new Error(
          `Pinned demo plan invalid: ${validated.errors.join('; ')}`,
        );
      }
      this.logger.log(
        `Plan pinned scenario=${scenario} steps=${validated.plan.steps.length}`,
      );
      return { plan: validated.plan, source: 'demo_pinned', scenario };
    }

    // Off-script: LLM generateObject + validate (+ 1 replan)
    if (!this.llm.isPrimaryConfigured && !this.llm.isFallbackConfigured) {
      // No keys — fall back to home DAG so demo never hard-fails
      this.logger.warn(
        'No LLM keys for off-script plan; falling back to home pinned DAG',
      );
      const plan = buildDemoLoanAssessmentPlan('home');
      return { plan, source: 'demo_pinned', scenario: 'home_fallback' };
    }

    let lastErrors: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { object } = await this.llm.generateObject({
        agentRole: 'planner',
        purpose: 'task_plan',
        schema: TaskPlanSchema,
        system: this.systemPrompt(),
        prompt:
          attempt === 1
            ? `User goal:\n${goal}\n\nProduce a TaskPlan with 1–5 steps.`
            : `User goal:\n${goal}\n\nPrevious plan was rejected:\n${lastErrors.join('\n')}\nFix and return a valid TaskPlan.`,
      });

      const validated = validateTaskPlan(object);
      if (validated.ok) {
        this.logger.log(
          `Plan from LLM steps=${validated.plan.steps.length} attempt=${attempt}`,
        );
        return { plan: validated.plan, source: 'llm', scenario: 'generic' };
      }
      lastErrors = validated.errors;
      this.logger.warn(`Plan validation failed attempt=${attempt}: ${lastErrors.join('; ')}`);
    }

    throw new Error(
      `Planner failed validation after replan: ${lastErrors.join('; ')}`,
    );
  }

  async synthesize(opts: {
    goal: string;
    plan: TaskPlan;
    stepOutputs: Array<{
      id: string;
      agentRole: string;
      output: unknown;
    }>;
  }): Promise<{ finalAnswer: string; usedLlm: boolean }> {
    const stubSummary = this.stubSynthesize(opts);
    if (!this.llm.isPrimaryConfigured && !this.llm.isFallbackConfigured) {
      return { finalAnswer: stubSummary, usedLlm: false };
    }

    try {
      const { text } = await this.llm.generateText({
        agentRole: 'planner',
        purpose: 'synthesize',
        system:
          'Bạn là Planner ngân hàng SHB. Dựa trên nhận định của các chuyên gia (ưu tiên trường analysis; các field số liệu chỉ để đối chiếu), viết bản nhận định tham khảo cho nhân viên tín dụng bằng tiếng Việt. Cấu trúc: (1) Khuyến nghị tổng — chọn một trong proceed_with_conditions | manual_review | do_not_proceed | insufficient_data; (2) Cơ sở đánh giá — tóm từ analysis của từng chuyên gia; (3) Rủi ro cần lưu ý; (4) Điểm chặn/bổ sung nếu có. Khi dẫn quy định, luôn chèn ngay sau câu liên quan theo đúng định dạng: (Trích dẫn: tên tài liệu — điều khoản). Không thêm mục danh sách trích dẫn riêng ở cuối. Không bịa số liệu ngoài dữ liệu chuyên gia. Không thêm câu lưu ý kiểu “đây là gợi ý, quyết định thuộc về con người”.',
        prompt: `Goal: ${opts.goal}\n\nPlan: ${opts.plan.summary}\n\nExpert step outputs (dùng analysis làm input chính):\n${JSON.stringify(opts.stepOutputs, null, 2)}\n\nViết bản nhận định + khuyến nghị cho nhân viên tín dụng.`,
      });
      return { finalAnswer: text, usedLlm: true };
    } catch (err) {
      this.logger.warn(
        `Synthesize LLM failed, using stub: ${err instanceof Error ? err.message : err}`,
      );
      return { finalAnswer: stubSummary, usedLlm: false };
    }
  }

  /**
   * Tổng hợp deterministic thành nhận định + khuyến nghị cho nhân viên.
   * Không phụ thuộc LLM: đọc output từng Expert để đưa góc nhìn tham khảo.
   */
  private stubSynthesize(opts: {
    goal: string;
    plan: TaskPlan;
    stepOutputs: Array<{ id: string; agentRole: string; output: unknown }>;
  }): string {
    const byRole = new Map<string, Record<string, unknown>>();
    for (const step of opts.stepOutputs) {
      if (step.output && typeof step.output === 'object') {
        byRole.set(step.agentRole, step.output as Record<string, unknown>);
      }
    }

    const credit = byRole.get('credit');
    const legal = byRole.get('legal');
    const collateral = byRole.get('collateral');
    const product = byRole.get('product');

    const reasons: string[] = [];
    const risks: string[] = [];
    const blocking: string[] = [];

    // Credit
    const creditEligible = credit?.eligible === true;
    const score = credit?.score ?? null;
    const maxAmount =
      typeof credit?.maxAmountVnd === 'number'
        ? (credit.maxAmountVnd as number)
        : null;
    if (credit) {
      if (typeof credit.analysis === 'string' && credit.analysis.trim()) {
        reasons.push(`Tín dụng: ${credit.analysis.trim()}`);
      } else if (creditEligible) {
        reasons.push(
          `Tín dụng: đủ điều kiện sơ bộ${score ? ` (điểm ${score})` : ''}${maxAmount ? `, hạn mức đề xuất ~${this.formatVnd(maxAmount)}` : ''}.`,
        );
      } else {
        blocking.push(
          `Tín dụng: chưa đạt điều kiện sơ bộ${score ? ` (điểm ${score})` : ''} — cần rà soát khả năng trả nợ.`,
        );
      }
    }

    // Legal / Compliance
    const amlStatus = (legal?.amlStatus as string | null) ?? null;
    if (legal) {
      if (typeof legal.analysis === 'string' && legal.analysis.trim()) {
        reasons.push(`Tuân thủ: ${legal.analysis.trim()}`);
      } else if (amlStatus === 'clear' || amlStatus === null) {
        reasons.push('Tuân thủ: AML/KYC không có cảnh báo chặn.');
      } else {
        risks.push(
          `Tuân thủ: AML ở trạng thái «${amlStatus}» — cần kiểm tra thủ công trước khi trình.`,
        );
      }
    }

    // Collateral
    const cStatus = (collateral?.status as string | null) ?? null;
    const ltv = collateral?.ltvActual ?? null;
    const policyLtv = collateral?.policyMaxLtv ?? null;
    if (collateral) {
      if (typeof collateral.analysis === 'string' && collateral.analysis.trim()) {
        reasons.push(`Tài sản bảo đảm: ${collateral.analysis.trim()}`);
      } else if (cStatus === 'not_applicable') {
        reasons.push('Tài sản bảo đảm: khoản vay tín chấp, không áp dụng LTV.');
      } else if (cStatus === 'acceptable') {
        reasons.push(
          `Tài sản bảo đảm: đạt kiểm tra sơ bộ${ltv ? `, LTV thực ${ltv}%` : ''}${policyLtv ? ` (ngưỡng ${policyLtv}%)` : ''}.`,
        );
      } else {
        const missing = Array.isArray(collateral?.missingData)
          ? (collateral.missingData as string[])
          : [];
        blocking.push(
          `Tài sản bảo đảm: cần bổ sung — ${missing.join('; ') || 'chưa đủ dữ liệu định giá'}.`,
        );
      }
    }

    // Product
    const recommendedProduct =
      (product?.recommendedProduct as string | null) ?? null;
    if (product) {
      if (typeof product.analysis === 'string' && product.analysis.trim()) {
        reasons.push(`Sản phẩm: ${product.analysis.trim()}`);
      } else if (recommendedProduct) {
        reasons.push(`Sản phẩm gợi ý: ${recommendedProduct}.`);
      }
    }

    // Khuyến nghị tổng
    let recommendation: string;
    if (blocking.length > 0) {
      recommendation =
        creditEligible === false
          ? 'do_not_proceed — chưa nên tiếp tục với dữ liệu hiện tại'
          : 'insufficient_data — cần bổ sung dữ liệu trước khi trình duyệt';
    } else if (risks.length > 0) {
      recommendation = 'manual_review — cần người có thẩm quyền kiểm tra thêm';
    } else {
      recommendation =
        'proceed_with_conditions — có thể trình duyệt kèm điều kiện tiêu chuẩn';
    }

    const citations = this.collectCitations(byRole);

    const lines: string[] = [];
    lines.push(`Khuyến nghị: ${recommendation}.`);
    lines.push('');
    if (reasons.length) {
      lines.push('Cơ sở đánh giá:');
      lines.push(...reasons.map((r) => `• ${r}`));
    }
    if (risks.length) {
      lines.push('');
      lines.push('Rủi ro cần lưu ý:');
      lines.push(...risks.map((r) => `• ${r}`));
    }
    if (blocking.length) {
      lines.push('');
      lines.push('Điểm chặn / cần bổ sung:');
      lines.push(...blocking.map((r) => `• ${r}`));
    }
    if (citations.length) {
      lines.push('');
      lines.push('Trích dẫn quy định:');
      lines.push(...citations.map((c) => `• ${c}`));
    }
    return lines.join('\n');
  }

  private collectCitations(
    byRole: Map<string, Record<string, unknown>>,
  ): string[] {
    const out: string[] = [];
    for (const output of byRole.values()) {
      const citations = output?.citations;
      if (!Array.isArray(citations)) continue;
      for (const cite of citations.slice(0, 2)) {
        const doc = (cite as { sourceDoc?: string; status?: string }) ?? {};
        if (doc.sourceDoc) {
          out.push(`${doc.sourceDoc}${doc.status ? ` [${doc.status}]` : ''}`);
        }
      }
    }
    return Array.from(new Set(out)).slice(0, 5);
  }

  private formatVnd(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
  }

  private systemPrompt(): string {
    return [
      'You are the Planner/Orchestrator for SHB Digital Expert Agents.',
      'Split the user goal into TaskSteps. Only use agentRole in {credit,legal,collateral,product,ops}.',
      'Max 5 steps. Prefer parallel independent steps then dependents.',
      'Do not invent roles. Match capabilities to the catalog.',
      '',
      'Agent catalog:',
      catalogPromptBlock(),
    ].join('\n');
  }
}
