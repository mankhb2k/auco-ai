import { SpecialistService } from './specialist.service';
import type { McpGatewayService } from '../../mcp-client/service/mcp-gateway.service';
import type { RagService } from '../../rag/service/rag.service';
import type { TaskStepPlan } from '../../planning/task-plan.schema';

describe('SpecialistService', () => {
  const mcp = { callTool: jest.fn() } as unknown as McpGatewayService;
  const rag = { kbTool: jest.fn() } as unknown as RagService;
  let service: SpecialistService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SpecialistService(mcp, rag);
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
});
