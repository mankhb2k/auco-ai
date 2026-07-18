import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithActor } from '../common/demo-actor.middleware';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import { isMcpCapability } from './connector-catalog';
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
  suite(@Req() req: RequestWithActor) {
    const status = this.registry.suiteStatus(req.actor!.bankCode);
    return {
      ...status,
      gatewayEnabled: this.gateway.enabled,
      message: status.connected
        ? 'Connected: SHB MCP Suite'
        : 'No connectors registered',
    };
  }

  @Patch('connectors/:capability')
  @RequireLayer('it_admin')
  setConnectorEnabled(
    @Req() req: RequestWithActor,
    @Param('capability') capability: string,
    @Body() body: { enabled?: boolean },
  ) {
    if (!isMcpCapability(capability)) {
      throw new BadRequestException(
        'capability must be one of los|compliance|core-banking|product|ops',
      );
    }
    if (typeof body?.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be boolean');
    }
    return this.registry.setConnectorEnabled(
      req.actor!.bankCode,
      capability,
      body.enabled,
      req.actor!.id,
    );
  }
}
