import { ConfigService } from '@nestjs/config';
import { McpGatewayService } from './mcp-gateway.service';
import { McpRegistryService } from './mcp-registry.service';

describe('McpGatewayService', () => {
  const registry = new McpRegistryService();

  function createService(mcpEnabled = 'true') {
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'MCP_SUITE_ENABLED') return mcpEnabled;
        return fallback;
      }),
    } as unknown as ConfigService;
    return new McpGatewayService(registry, config);
  }

  it('enabled is true by default', () => {
    expect(createService().enabled).toBe(true);
  });

  it('enabled is false when MCP_SUITE_ENABLED=false', () => {
    expect(createService('false').enabled).toBe(false);
  });

  it('assertAllowed accepts credit tool on allowlist', () => {
    expect(() =>
      createService().assertAllowed('credit', 'get_credit_score'),
    ).not.toThrow();
  });

  it('assertAllowed rejects unknown tool', () => {
    expect(() =>
      createService().assertAllowed('credit', 'not_a_real_tool'),
    ).toThrow(/Unknown MCP tool/);
  });

  it('callTool throws when suite is disabled', async () => {
    await expect(
      createService('false').callTool({
        agentRole: 'credit',
        tool: 'get_credit_score',
      }),
    ).rejects.toThrow(/MCP suite disabled/);
  });
});
