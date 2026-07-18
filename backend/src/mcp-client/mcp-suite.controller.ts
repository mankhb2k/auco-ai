import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import { McpGatewayService } from './service/mcp-gateway.service';
import { McpRegistryService } from './service/mcp-registry.service';

@Controller('api/mcp')
@UseGuards(RequireLayerGuard)
export class McpSuiteController {
  constructor(
    private readonly registry: McpRegistryService,
    private readonly gateway: McpGatewayService,
  ) {}

  @Get('suite')
  @RequireLayer('it_admin', 'manager')
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
