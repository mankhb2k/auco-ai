import { Module } from '@nestjs/common';
import { McpGatewayService } from './service/mcp-gateway.service';
import { McpRegistryService } from './service/mcp-registry.service';
import { McpSuiteController } from './mcp-suite.controller';

@Module({
  controllers: [McpSuiteController],
  providers: [McpRegistryService, McpGatewayService],
  exports: [McpRegistryService, McpGatewayService],
})
export class McpClientModule {}
