import { Module } from '@nestjs/common';
import { McpGatewayService } from './mcp-gateway.service';
import { McpRegistryService } from './mcp-registry.service';
import { McpSuiteController } from './mcp-suite.controller';

@Module({
  controllers: [McpSuiteController],
  providers: [McpRegistryService, McpGatewayService],
  exports: [McpRegistryService, McpGatewayService],
})
export class McpClientModule {}
