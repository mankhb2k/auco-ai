import { SpecialistStubService } from './specialist-stub.service';
import type { TaskStepPlan } from '../../planning/task-plan.schema';

describe('SpecialistStubService', () => {
  const service = new SpecialistStubService();
  const baseCtx = { goal: 'demo goal', priorOutputs: {} };

  it('runs credit with spawn_workers mode', async () => {
    const step: TaskStepPlan = {
      id: 'step-credit',
      agentRole: 'credit',
      goal: 'Đánh giá tín dụng',
      dependsOn: [],
      mode: 'spawn_workers',
    };
    const result = await service.run(step, baseCtx);
    expect(result.mode).toBe('spawn_workers');
    expect(result.toolCalls).toHaveLength(3);
    expect(result.output.eligible).toBe(true);
  });

  it('runs legal stub', async () => {
    const step: TaskStepPlan = {
      id: 'step-legal',
      agentRole: 'legal',
      goal: 'AML check',
      dependsOn: [],
      mode: 'direct',
    };
    const result = await service.run(step, baseCtx);
    expect(result.output.amlStatus).toBe('clear');
    expect(result.toolCalls[0]?.tool).toBe('run_aml_check');
  });

  it('runs product stub', async () => {
    const step: TaskStepPlan = {
      id: 'step-product',
      agentRole: 'product',
      goal: 'Đề xuất sản phẩm',
      dependsOn: ['step-credit'],
      mode: 'direct',
    };
    const result = await service.run(step, {
      goal: 'demo',
      priorOutputs: { 'step-credit': { eligible: true } },
    });
    expect(result.output.recommendedProduct).toBe('SHB Home Loan Standard');
  });

  it('runs ops stub with mutate tool', async () => {
    const step: TaskStepPlan = {
      id: 'step-ops',
      agentRole: 'ops',
      goal: 'Tạo ticket',
      dependsOn: [],
      mode: 'direct',
    };
    const result = await service.run(step, baseCtx);
    expect(result.toolCalls[0]?.mutates).toBe(true);
    expect(result.output.ticketId).toBe('TK-STUB-001');
  });
});
