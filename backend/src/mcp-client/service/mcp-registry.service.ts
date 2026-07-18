import { Injectable } from '@nestjs/common';
import {
  findConnector,
  SHB_CONNECTORS,
  type BankMcpConnector,
  type McpCapability,
} from '../connector-catalog';

@Injectable()
export class McpRegistryService {
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

  suiteStatus(bankCode = 'SHB') {
    const connectors = this.listConnectors(bankCode).map((c) => ({
      capability: c.capability,
      serverName: c.serverName,
      transport: c.transport,
      implementation: c.implementation,
      status: 'registered' as const,
      tools: c.tools,
    }));
    return {
      suite: 'SHB MCP Suite',
      bankCode,
      connected: connectors.length > 0,
      connectorCount: connectors.length,
      connectors,
    };
  }
}
