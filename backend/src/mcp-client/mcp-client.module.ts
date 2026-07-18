import { Module } from '@nestjs/common';
import { McpGatewayService } from './service/mcp-gateway.service';
import { McpRegistryService } from './service/mcp-registry.service';

@Module({
  providers: [McpRegistryService, McpGatewayService],
  exports: [McpRegistryService, McpGatewayService],
})
export class McpClientModule {}
