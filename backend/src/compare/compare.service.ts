import { Injectable, Logger } from '@nestjs/common';
import {
  buildCompareMetrics,
  buildVerdict,
  type CompareMetrics,
} from './compare-metrics';
import { TaskRunsService } from '../planning/task-runs.service';

export type CompareResult = {
  goal: string;
  bankCode: string;
  multi: CompareMetrics;
  single: CompareMetrics;
  verdict: string;
};

@Injectable()
export class CompareService {
  private readonly logger = new Logger(CompareService.name);

  constructor(private readonly taskRuns: TaskRunsService) {}

  async runCompare(opts: {
    goal: string;
    bankCode?: string;
  }): Promise<CompareResult> {
    const goal = opts.goal.trim();
    const bankCode = opts.bankCode?.trim() || 'SHB';

    this.logger.log(`Compare start goal="${goal.slice(0, 80)}"`);

    // Multi first (skip HITL so DAG finishes), then single baseline
    const multiTask = await this.taskRuns.create({
      goal,
      bankCode,
      mode: 'multi',
      skipApprovalPropose: true,
      async: false,
    });

    const singleTask = await this.taskRuns.create({
      goal,
      bankCode,
      mode: 'single',
      skipApprovalPropose: true,
      async: false,
    });

    const multi = buildCompareMetrics('multi', multiTask);
    const single = buildCompareMetrics('single', singleTask);
    const verdict = buildVerdict(multi, single);

    this.logger.log(
      `Compare done multi=${multi.latencyMs}ms single=${single.latencyMs}ms`,
    );

    return { goal, bankCode, multi, single, verdict };
  }
}
