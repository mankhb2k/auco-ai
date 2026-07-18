import { McpRegistryService } from './mcp-registry.service';
import type { AuditService } from '../../audit/service/audit.service';

describe('McpRegistryService', () => {
  let service: McpRegistryService;
  const audit = { recordSafe: jest.fn() } as unknown as AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new McpRegistryService(audit);
  });

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
    expect(status.enabledCount).toBe(status.connectorCount);
    expect(status.connectors.every((connector) => connector.enabled)).toBe(
      true,
    );
  });

  it('disables and re-enables connector capability at runtime', () => {
    const disabled = service.setConnectorEnabled('SHB', 'ops', false);

    expect(disabled).toEqual(
      expect.objectContaining({
        capability: 'ops',
        enabled: false,
        status: 'disabled',
        persistence: 'in_memory_demo',
      }),
    );
    expect(service.isConnectorEnabled('SHB', 'ops')).toBe(false);
    expect(
      service.suiteStatus('SHB').connectors.find(
        (connector) => connector.capability === 'ops',
      ),
    ).toEqual(expect.objectContaining({ enabled: false, status: 'disabled' }));

    service.setConnectorEnabled('SHB', 'ops', true);
    expect(service.isConnectorEnabled('SHB', 'ops')).toBe(true);
  });

  it('rejects override for unknown bank connector', () => {
    expect(() =>
      service.setConnectorEnabled('UNKNOWN', 'ops', false),
    ).toThrow(/No MCP connector/);
  });
});
