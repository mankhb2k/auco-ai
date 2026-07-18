import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../../llm/llm.gateway';
import { catalogPromptBlock } from '../../agents/agent-catalog';
import {
  buildDemoThreeStepPlan,
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

    // Demo cases: pin Credit ‖ Legal → Product (không phụ thuộc LLM)
    if (scenario !== 'generic') {
      const plan = buildDemoThreeStepPlan(scenario);
      const validated = validateTaskPlan(plan, { demoPinned: true });
      if (!validated.ok) {
        throw new Error(
          `Pinned demo plan invalid: ${validated.errors.join('; ')}`,
        );
      }
      this.logger.log(`Plan pinned scenario=${scenario} steps=3`);
      return { plan: validated.plan, source: 'demo_pinned', scenario };
    }

    // Off-script: LLM generateObject + validate (+ 1 replan)
    if (!this.llm.isPrimaryConfigured && !this.llm.isFallbackConfigured) {
      // No keys — fall back to home DAG so demo never hard-fails
      this.logger.warn(
        'No LLM keys for off-script plan; falling back to home pinned DAG',
      );
      const plan = buildDemoThreeStepPlan('home');
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
          'Bạn là Planner ngân hàng SHB. Tổng hợp kết quả các chuyên gia thành 1 câu trả lời tiếng Việt rõ ràng, có citation nếu có, không bịa số liệu.',
        prompt: `Goal: ${opts.goal}\n\nPlan: ${opts.plan.summary}\n\nStep outputs:\n${JSON.stringify(opts.stepOutputs, null, 2)}\n\nViết finalAnswer ngắn gọn cho nhân viên tín dụng.`,
      });
      return { finalAnswer: text, usedLlm: true };
    } catch (err) {
      this.logger.warn(
        `Synthesize LLM failed, using stub: ${err instanceof Error ? err.message : err}`,
      );
      return { finalAnswer: stubSummary, usedLlm: false };
    }
  }

  private stubSynthesize(opts: {
    goal: string;
    plan: TaskPlan;
    stepOutputs: Array<{ id: string; agentRole: string; output: unknown }>;
  }): string {
    const lines = opts.stepOutputs.map(
      (s) =>
        `- [${s.agentRole}] ${typeof s.output === 'object' && s.output && 'summary' in (s.output as object) ? String((s.output as { summary: string }).summary) : JSON.stringify(s.output).slice(0, 200)}`,
    );
    return [
      `Tổng hợp (stub Phase 4) cho mục tiêu: ${opts.goal}`,
      `Kế hoạch: ${opts.plan.summary}`,
      ...lines,
      'Các bước chuyên gia đã hoàn tất. (LLM synthesize sẽ bật khi có API key.)',
    ].join('\n');
  }

  private systemPrompt(): string {
    return [
      'You are the Planner/Orchestrator for SHB Digital Expert Agents.',
      'Split the user goal into TaskSteps. Only use agentRole in {credit,legal,product,ops}.',
      'Max 5 steps. Prefer parallel independent steps then dependents.',
      'Do not invent roles. Match capabilities to the catalog.',
      '',
      'Agent catalog:',
      catalogPromptBlock(),
    ].join('\n');
  }
}
