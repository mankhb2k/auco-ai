import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROLE_TOOL_ALLOWLIST,
  toolCapability,
  type McpCapability,
} from './connector-catalog';
import { McpRegistryService } from './mcp-registry.service';
import { getAgentByRole, type AgentRole } from '../agents/agent-catalog';

type McpSdk = {
  Client: new (
    info: { name: string; version: string },
    opts?: { capabilities?: object },
  ) => {
    connect: (t: unknown) => Promise<void>;
    close: () => Promise<void>;
    callTool: (args: {
      name: string;
      arguments?: Record<string, unknown>;
    }) => Promise<{ content?: Array<{ type: string; text?: string }> }>;
    listTools: () => Promise<{ tools: Array<{ name: string }> }>;
  };
  StdioClientTransport: new (opts: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    stderr?: 'pipe' | 'inherit' | 'ignore';
  }) => { close?: () => Promise<void> };
  getDefaultEnvironment: () => Record<string, string>;
};

export type McpCallResult = {
  tool: string;
  capability: McpCapability;
  mcp: string;
  bankCode: string;
  mutates: boolean;
  requiresApproval: boolean;
  latencyMs: number;
  output: unknown;
};

@Injectable()
export class McpGatewayService implements OnModuleDestroy {
  private readonly logger = new Logger(McpGatewayService.name);
  private sdk: McpSdk | null = null;
  private readonly sessions = new Map<
    string,
    { client: InstanceType<McpSdk['Client']>; transport: unknown }
  >();

  constructor(
    private readonly registry: McpRegistryService,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean {
    return this.config.get<string>('MCP_SUITE_ENABLED', 'true') !== 'false';
  }

  async onModuleDestroy() {
    for (const [key, s] of this.sessions) {
      try {
        await s.client.close();
      } catch {
        /* ignore */
      }
      this.sessions.delete(key);
    }
  }

  assertAllowed(agentRole: AgentRole, tool: string) {
    const agent = getAgentByRole(agentRole);
    const capability = toolCapability(tool);
    if (!capability) {
      throw new Error(`Unknown MCP tool: ${tool}`);
    }
    if (!agent.allowedMcp.includes(capability)) {
      throw new Error(
        `Role ${agentRole} cannot use capability ${capability} (tool ${tool})`,
      );
    }
    const allow = ROLE_TOOL_ALLOWLIST[agentRole] ?? [];
    if (!allow.includes(tool)) {
      throw new Error(`Role ${agentRole} tool allowlist blocks ${tool}`);
    }
  }

  async callTool(opts: {
    bankCode?: string;
    agentRole: AgentRole;
    tool: string;
    args?: Record<string, unknown>;
    /** Phase 9 baseline single-agent — intentionally bypass role allowlist */
    skipAllowlist?: boolean;
  }): Promise<McpCallResult> {
    if (!this.enabled) {
      throw new Error('MCP suite disabled (MCP_SUITE_ENABLED=false)');
    }

    if (!opts.skipAllowlist) {
      this.assertAllowed(opts.agentRole, opts.tool);
    }
    const bankCode = opts.bankCode?.trim() || 'SHB';
    const capability = toolCapability(opts.tool);
    if (!capability) {
      throw new Error(`Unknown MCP tool: ${opts.tool}`);
    }
    const connector = this.registry.resolve(bankCode, capability);
    const toolMeta = connector.tools.find((t) => t.name === opts.tool);

    const started = Date.now();
    const client = await this.getClient(bankCode, capability);
    const raw = await client.callTool({
      name: opts.tool,
      arguments: opts.args ?? {},
    });
    const output = this.parseToolContent(raw);
    const latencyMs = Date.now() - started;

    this.logger.log(
      `MCP ${connector.serverName}.${opts.tool} ${latencyMs}ms role=${opts.agentRole}${opts.skipAllowlist ? ' [baseline]' : ''}`,
    );

    return {
      tool: opts.tool,
      capability,
      mcp: connector.serverName,
      bankCode,
      mutates: toolMeta?.mutates ?? false,
      requiresApproval: toolMeta?.requiresApproval ?? false,
      latencyMs,
      output,
    };
  }

  private parseToolContent(raw: {
    content?: Array<{ type: string; text?: string }>;
  }): unknown {
    const text = raw.content?.find((c) => c.type === 'text')?.text;
    if (!text) return raw;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { text };
    }
  }

  private async getClient(bankCode: string, capability: McpCapability) {
    const key = `${bankCode}:${capability}`;
    const existing = this.sessions.get(key);
    if (existing) return existing.client;

    const sdk = await this.loadSdk();
    const connector = this.registry.resolve(bankCode, capability);
    const { command, args, cwd } = this.resolveSpawn(connector.entryRel, connector.entryTsRel);

    const env: Record<string, string> = {
      ...sdk.getDefaultEnvironment(),
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      NODE_ENV: process.env.NODE_ENV ?? 'development',
    };

    const transport = new sdk.StdioClientTransport({
      command,
      args,
      cwd,
      env,
      stderr: 'pipe',
    });

    const client = new sdk.Client(
      { name: 'auco-mcp-gateway', version: '1.0.0' },
      { capabilities: {} },
    );
    await client.connect(transport);
    this.sessions.set(key, { client, transport });
    this.logger.log(`Connected MCP session ${key} via ${command} ${args.join(' ')}`);
    return client;
  }

  private resolveSpawn(entryRel: string, entryTsRel: string) {
    const cwd = process.cwd();
    const compiled = join(cwd, entryRel);
    const tsEntry = join(cwd, entryTsRel);
    const tsxCli = join(cwd, 'node_modules', 'tsx', 'dist', 'cli.mjs');

    if (existsSync(compiled)) {
      return { command: process.execPath, args: [compiled], cwd };
    }
    if (existsSync(tsxCli) && existsSync(tsEntry)) {
      return {
        command: process.execPath,
        args: [tsxCli, tsEntry],
        cwd,
      };
    }
    throw new Error(
      `MCP entry not found. Build mcp servers or install tsx. Tried ${compiled} and ${tsEntry}`,
    );
  }

  private async loadSdk(): Promise<McpSdk> {
    if (this.sdk) return this.sdk;
    const clientMod = (await import(
      '@modelcontextprotocol/sdk/client/index.js'
    )) as { Client: McpSdk['Client'] };
    const stdioMod = (await import(
      '@modelcontextprotocol/sdk/client/stdio.js'
    )) as {
      StdioClientTransport: McpSdk['StdioClientTransport'];
      getDefaultEnvironment: McpSdk['getDefaultEnvironment'];
    };
    this.sdk = {
      Client: clientMod.Client,
      StdioClientTransport: stdioMod.StdioClientTransport,
      getDefaultEnvironment: stdioMod.getDefaultEnvironment,
    };
    return this.sdk;
  }
}
