import { Controller, Get, Query } from '@nestjs/common';
import { McpGatewayService } from './service/mcp-gateway.service';
import { McpRegistryService } from './service/mcp-registry.service';

@Controller('api/mcp')
export class McpSuiteController {
  constructor(
    private readonly registry: McpRegistryService,
    private readonly gateway: McpGatewayService,
  ) {}

  @Get('suite')
  suite(@Query('bankCode') bankCode?: string) {
    const status = this.registry.suiteStatus(bankCode?.trim() || 'SHB');
    return {
      ...status,
      gatewayEnabled: this.gateway.enabled,
      message: status.connected
        ? 'Connected: SHB MCP Suite'
        : 'No connectors registered',
    };
  }
}
