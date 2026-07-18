import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AgentRole } from '../agents/agent-catalog';
import { McpGatewayService } from '../mcp-client/mcp-gateway.service';
import { OrchestratorService } from '../planning/orchestrator.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

type PendingApproval = {
  reason: string;
  preview: string;
  tool: string;
  args: Record<string, unknown>;
  agentRole: AgentRole;
};

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mcp: McpGatewayService,
    private readonly orchestrator: OrchestratorService,
    private readonly realtime: RealtimeService,
  ) {}

  async listPending(taskRunId?: string) {
    return this.prisma.taskStep.findMany({
      where: {
        status: 'waiting_approval',
        ...(taskRunId ? { taskRunId } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        taskRun: { select: { id: true, goal: true, status: true, bankCode: true } },
      },
    });
  }

  async approve(stepId: string, actorId?: string) {
    const step = await this.prisma.taskStep.findUnique({
      where: { id: stepId },
      include: { taskRun: true },
    });
    if (!step) throw new NotFoundException(`Step ${stepId} not found`);
    if (step.status !== 'waiting_approval') {
      throw new BadRequestException(
        `Step status is ${step.status}, expected waiting_approval`,
      );
    }

    const pending = this.readPending(step.output);
    const result = await this.mcp.callTool({
      bankCode: step.taskRun.bankCode,
      agentRole: pending.agentRole,
      tool: pending.tool,
      args: pending.args,
    });

    const prevCalls = Array.isArray(step.toolCalls)
      ? (step.toolCalls as Array<Record<string, unknown>>)
      : [];
    const toolCalls = [
      ...prevCalls.filter((c) => c.status !== 'pending_approval'),
      {
        id: `approved-${Date.now().toString(36)}`,
        tool: result.tool,
        mcp: result.mcp,
        capability: result.capability,
        mutates: result.mutates,
        latencyMs: result.latencyMs,
        approved: true,
        actorId: actorId ?? 'demo-reviewer',
        output: result.output,
      },
    ];

    const prevOut =
      step.output && typeof step.output === 'object'
        ? (step.output as Record<string, unknown>)
        : {};

    await this.prisma.taskStep.update({
      where: { id: stepId },
      data: {
        status: 'done',
        toolCalls: toolCalls as Prisma.InputJsonValue[],
        output: {
          ...prevOut,
          pendingApproval: undefined,
          approved: true,
          approvalActorId: actorId ?? 'demo-reviewer',
          mutateResult: result.output,
          summary: `${String(prevOut.summary ?? '')} — ĐÃ DUYỆT: ${pending.tool}`,
        } as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });

    this.realtime.emitStepUpdated(step.taskRunId, {
      stepId,
      status: 'done',
      approved: true,
    });

    await this.orchestrator.resumeTaskRun(step.taskRunId);
    return this.prisma.taskStep.findUnique({
      where: { id: stepId },
      include: { taskRun: { include: { steps: true } } },
    });
  }

  async reject(stepId: string, opts?: { reason?: string; actorId?: string }) {
    const step = await this.prisma.taskStep.findUnique({
      where: { id: stepId },
      include: { taskRun: true },
    });
    if (!step) throw new NotFoundException(`Step ${stepId} not found`);
    if (step.status !== 'waiting_approval') {
      throw new BadRequestException(
        `Step status is ${step.status}, expected waiting_approval`,
      );
    }

    const pending = this.readPending(step.output);
    const reason = opts?.reason?.trim() || 'Người duyệt từ chối side-effect';
    const prevOut =
      step.output && typeof step.output === 'object'
        ? (step.output as Record<string, unknown>)
        : {};

    await this.prisma.taskStep.update({
      where: { id: stepId },
      data: {
        status: 'failed',
        output: {
          ...prevOut,
          approved: false,
          rejected: true,
          rejectReason: reason,
          approvalActorId: opts?.actorId ?? 'demo-reviewer',
          summary: `${String(prevOut.summary ?? '')} — TỪ CHỐI: ${pending.tool} (${reason})`,
        } as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });

    await this.prisma.taskRun.update({
      where: { id: step.taskRunId },
      data: {
        status: 'failed',
        finalAnswer: `Side-effect bị từ chối: ${pending.tool}. Lý do: ${reason}`,
      },
    });

    this.realtime.emitStepUpdated(step.taskRunId, {
      stepId,
      status: 'failed',
      rejected: true,
    });
    this.realtime.emitTaskUpdated(step.taskRunId, {
      status: 'failed',
      rejected: true,
    });

    return this.prisma.taskStep.findUnique({
      where: { id: stepId },
      include: { taskRun: true },
    });
  }

  private readPending(output: unknown): PendingApproval {
    const o = output as { pendingApproval?: PendingApproval } | null;
    if (!o?.pendingApproval?.tool || !o.pendingApproval.agentRole) {
      throw new BadRequestException('Step has no pendingApproval payload');
    }
    return o.pendingApproval;
  }
}
