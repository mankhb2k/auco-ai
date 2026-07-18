import { McpRegistryService } from './mcp-registry.service';

describe('McpRegistryService', () => {
  const service = new McpRegistryService();

  it('lists SHB connectors by default', () => {
    const connectors = service.listConnectors();
    expect(connectors.length).toBeGreaterThan(0);
    expect(connectors.every((c) => c.bankCode === 'SHB')).toBe(true);
  });

  it('resolves a known capability', () => {
    const connector = service.resolve('SHB', 'los');
    expect(connector.serverName).toBeTruthy();
    expect(connector.capability).toBe('los');
  });

  it('throws when capability is missing for bank', () => {
    expect(() => service.resolve('UNKNOWN', 'los')).toThrow(/No MCP connector/);
  });

  it('returns suite status with registered connectors', () => {
    const status = service.suiteStatus('SHB');
    expect(status.suite).toBe('SHB MCP Suite');
    expect(status.connected).toBe(true);
    expect(status.connectorCount).toBe(status.connectors.length);
  });
});
