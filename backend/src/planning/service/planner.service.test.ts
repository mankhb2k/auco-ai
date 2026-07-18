import { PlannerService } from './planner.service';
import type { LlmGatewayService } from '../../llm/llm.gateway';

describe('PlannerService', () => {
  const llm = {
    isPrimaryConfigured: false,
    isFallbackConfigured: false,
    generateObject: jest.fn(),
    generateText: jest.fn(),
  } as unknown as LlmGatewayService;

  let service: PlannerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlannerService(llm);
  });

  it('pins demo home DAG for home-loan goals', async () => {
    const result = await service.createPlan(
      'KH Nguyễn Văn An vay mua nhà 2 tỷ tại SHB',
    );
    expect(result.source).toBe('demo_pinned');
    expect(result.scenario).toBe('home');
    expect(result.plan.steps).toHaveLength(4);
    expect(result.plan.steps.map((s) => s.agentRole)).toEqual([
      'credit',
      'legal',
      'collateral',
      'product',
    ]);
  });

  it('falls back to home pinned DAG when LLM keys missing for generic goal', async () => {
    const result = await service.createPlan('Hỏi về giờ làm việc chi nhánh');
    expect(result.source).toBe('demo_pinned');
    expect(result.scenario).toBe('home_fallback');
    expect(result.plan.steps).toHaveLength(4);
  });
});
