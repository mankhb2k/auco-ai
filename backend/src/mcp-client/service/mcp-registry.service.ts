import { Injectable } from '@nestjs/common';
import {
  findConnector,
  SHB_CONNECTORS,
  type BankMcpConnector,
  type McpCapability,
} from '../connector-catalog';

@Injectable()
export class McpRegistryService {
  /** Phase R4 demo override; production moves this state to Redis/config store. */
  private readonly enabledOverrides = new Map<string, boolean>();

  listConnectors(bankCode = 'SHB'): BankMcpConnector[] {
    return SHB_CONNECTORS.filter((c) => c.bankCode === bankCode);
  }

  resolve(bankCode: string, capability: McpCapability): BankMcpConnector {
    const found = findConnector(bankCode, capability);
    if (!found) {
      throw new Error(
        `No MCP connector for bankCode=${bankCode} capability=${capability}`,
      );
    }
    return found;
  }

  isConnectorEnabled(
    bankCode: string,
    capability: McpCapability,
  ): boolean {
    // Resolve first so unknown bank/capability cannot create phantom overrides.
    this.resolve(bankCode, capability);
    return this.enabledOverrides.get(this.key(bankCode, capability)) ?? true;
  }

  setConnectorEnabled(
    bankCode: string,
    capability: McpCapability,
    enabled: boolean,
  ) {
    const connector = this.resolve(bankCode, capability);
    this.enabledOverrides.set(this.key(bankCode, capability), enabled);
    return {
      bankCode,
      capability,
      serverName: connector.serverName,
      enabled,
      status: enabled ? ('enabled' as const) : ('disabled' as const),
      persistence: 'in_memory_demo' as const,
    };
  }

  suiteStatus(bankCode = 'SHB') {
    const connectors = this.listConnectors(bankCode).map((c) => {
      const enabled = this.isConnectorEnabled(bankCode, c.capability);
      return {
        capability: c.capability,
        serverName: c.serverName,
        transport: c.transport,
        implementation: c.implementation,
        enabled,
        status: enabled ? ('enabled' as const) : ('disabled' as const),
        tools: c.tools,
      };
    });
    const enabledCount = connectors.filter((c) => c.enabled).length;
    return {
      suite: 'SHB MCP Suite',
      bankCode,
      connected: enabledCount > 0,
      connectorCount: connectors.length,
      enabledCount,
      connectors,
    };
  }

  private key(bankCode: string, capability: McpCapability) {
    return `${bankCode}:${capability}`;
  }
}
