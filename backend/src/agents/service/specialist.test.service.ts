import { SpecialistService } from './specialist.service';
import type { ActorsService } from '../../actors/service/actors.service';
import type { McpGatewayService } from '../../mcp-client/service/mcp-gateway.service';
import type { RagService } from '../../rag/service/rag.service';
import type { TaskStepPlan } from '../../planning/task-plan.schema';

describe('SpecialistService', () => {
  const mcp = { callTool: jest.fn() } as unknown as McpGatewayService;
  const rag = { kbTool: jest.fn() } as unknown as RagService;
  const actors = {
    isCustomerInPortfolio: jest.fn().mockResolvedValue(true),
  } as unknown as ActorsService;
  let service: SpecialistService;

  beforeEach(() => {
    jest.clearAllMocks();
    (actors.isCustomerInPortfolio as jest.Mock).mockResolvedValue(true);
    service = new SpecialistService(mcp, rag, actors);
    (mcp.callTool as jest.Mock).mockResolvedValue({
      tool: 'compare_products',
      mcp: 'mcp-product',
      capability: 'product',
      mutates: false,
      requiresApproval: false,
      latencyMs: 5,
      output: { products: ['SHB Home Loan Standard'] },
    });
    (rag.kbTool as jest.Mock).mockResolvedValue({
      tool: 'legal_kb_search',
      domain: 'legal',
      mutates: false,
      mode: 'empty',
      citations: [],
      summary: 'empty',
    });
  });

  it('runs product specialist via MCP', async () => {
    const step: TaskStepPlan = {
      id: 'step-product',
      agentRole: 'product',
      goal: 'Đề xuất sản phẩm vay nhà',
      dependsOn: ['step-credit', 'step-legal'],
      mode: 'direct',
    };
    const result = await service.run(step, {
      goal: 'KH Nguyễn Văn An vay mua nhà',
      bankCode: 'SHB',
      priorOutputs: { 'step-credit': { eligible: true } },
    });
    expect(result.mode).toBe('direct');
    expect(mcp.callTool).toHaveBeenCalled();
    expect(result.toolCalls.length).toBeGreaterThan(0);
  });

  it('runs legal specialist', async () => {
    (mcp.callTool as jest.Mock).mockResolvedValue({
      tool: 'run_aml_check',
      mcp: 'mcp-compliance',
      capability: 'compliance',
      mutates: false,
      requiresApproval: false,
      latencyMs: 8,
      output: { status: 'clear', risk: 'low' },
    });
    const step: TaskStepPlan = {
      id: 'step-legal',
      agentRole: 'legal',
      goal: 'Kiểm tra AML/KYC',
      dependsOn: [],
      mode: 'direct',
    };
    const result = await service.run(step, {
      goal: 'AML check KH',
      priorOutputs: {},
    });
    expect(result.mode).toBe('direct');
    expect(mcp.callTool).toHaveBeenCalled();
  });

  it('parks out_of_portfolio_access when customer outside portfolio', async () => {
    (actors.isCustomerInPortfolio as jest.Mock).mockResolvedValue(false);
    const step: TaskStepPlan = {
      id: 'step-credit',
      agentRole: 'credit',
      goal: 'Đánh giá tín dụng',
      dependsOn: [],
      mode: 'spawn_workers',
    };

    const result = await service.run(step, {
      goal: 'KH ngoài danh mục SHB-KH-9999 vay mua nhà',
      priorOutputs: {},
      employeeId: 'emp-credit-b',
    });

    expect(result.pendingApproval?.reason).toBe('out_of_portfolio_access');
    expect(result.pendingApproval?.tool).toBe('grant_portfolio_access');
    expect(mcp.callTool).not.toHaveBeenCalled();
  });
});
