import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LlmGatewayService } from '../llm/llm.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { computeNextRunAt } from './cron.util';

type GraphStep = { type: string; [key: string]: unknown };

@Injectable()
export class AutomationRunnerService {
  private readonly logger = new Logger(AutomationRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmGatewayService,
    private readonly realtime: RealtimeService,
  ) {}

  async run(
    automationId: string,
    opts?: { actorId?: string; trigger?: 'schedule' | 'manual' },
  ) {
    const auto = await this.prisma.automation.findUniqueOrThrow({
      where: { id: automationId },
    });

    const run = await this.prisma.automationRun.create({
      data: {
        automationId,
        status: 'running',
        actorId: opts?.actorId ?? (opts?.trigger === 'manual' ? 'user' : 'scheduler'),
      },
    });

    this.realtime.emitAutomationRunUpdated(automationId, {
      runId: run.id,
      status: 'running',
    });

    const graph = (auto.graphJson ?? { steps: [] }) as {
      steps?: GraphStep[];
    };
    const steps = graph.steps ?? [];
    const trace: Array<Record<string, unknown>> = [];
    let extractPayload: Record<string, unknown> = {};
    let summaryText = '';

    try {
      for (const step of steps) {
        const started = Date.now();
        if (step.type === 'trigger.cron') {
          trace.push({
            type: step.type,
            status: 'ok',
            latencyMs: Date.now() - started,
            detail: { cronExpr: auto.cronExpr, trigger: opts?.trigger ?? 'schedule' },
          });
          continue;
        }

        if (step.type === 'extract') {
          const customers = await this.prisma.customer.findMany({
            where: { bankCode: auto.bankCode },
            take: 50,
            select: {
              id: true,
              customerNo: true,
              fullName: true,
              profileJson: true,
            },
          });
          const alerts = customers
            .map((c) => {
              const p = (c.profileJson ?? {}) as Record<string, unknown>;
              const cic = Number(p.cicGroup ?? 1);
              const tag = String(p.demoTag ?? '');
              if (cic >= 3 || tag.includes('fx') || tag.includes('canh_bao')) {
                return {
                  customerNo: c.customerNo,
                  fullName: c.fullName,
                  cicGroup: cic,
                  demoTag: tag || null,
                  level: cic >= 4 ? 'high' : 'medium',
                };
              }
              return null;
            })
            .filter(Boolean);

          extractPayload = {
            customerCount: customers.length,
            alertCount: alerts.length,
            alerts,
            period: 'previous_month',
            capability: step.capability ?? 'core-banking',
          };
          trace.push({
            type: step.type,
            status: 'ok',
            latencyMs: Date.now() - started,
            detail: extractPayload,
          });
          continue;
        }

        if (step.type === 'llm-transform') {
          const fallback = `Báo cáo rủi ro tín dụng: ${extractPayload.customerCount ?? 0} KH trong phạm vi, ${extractPayload.alertCount ?? 0} cảnh báo. ${(extractPayload.alerts as unknown[] | undefined)?.length ? 'Ưu tiên theo dõi các KH có CIC/FX cảnh báo.' : 'Không có cảnh báo đáng kể.'}`;
          summaryText = fallback;
          if (this.llm.isPrimaryConfigured || this.llm.isFallbackConfigured) {
            try {
              const { text } = await this.llm.generateText({
                agentRole: auto.createdByAgentRole,
                purpose: String(step.purpose ?? 'risk_summary'),
                system:
                  'Bạn là Credit Ops SHB. Viết tóm tắt báo cáo rủi ro ngắn gọn tiếng Việt từ dữ liệu extract. Không bịa số.',
                prompt: JSON.stringify(extractPayload, null, 2),
              });
              summaryText = text;
            } catch (err) {
              this.logger.warn(
                `llm-transform fallback: ${err instanceof Error ? err.message : err}`,
              );
            }
          }
          trace.push({
            type: step.type,
            status: 'ok',
            latencyMs: Date.now() - started,
            detail: { summary: summaryText, usedLlm: summaryText !== fallback },
          });
          continue;
        }

        if (step.type === 'notification') {
          trace.push({
            type: step.type,
            status: 'ok',
            latencyMs: Date.now() - started,
            detail: {
              channel: step.channel ?? 'dashboard',
              message: summaryText.slice(0, 500),
            },
          });
          continue;
        }

        trace.push({
          type: step.type,
          status: 'skipped',
          latencyMs: Date.now() - started,
          detail: { reason: 'unknown_step_type' },
        });
      }

      const resultSummary =
        summaryText ||
        `Automation ${auto.name} hoàn tất (${trace.length} steps).`;

      const nextRunAt =
        auto.enabled && auto.cronExpr
          ? computeNextRunAt(auto.cronExpr, auto.timezone)
          : auto.nextRunAt;

      await this.prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'done',
          finishedAt: new Date(),
          resultSummary,
          traceJson: trace as Prisma.InputJsonValue,
        },
      });

      await this.prisma.automation.update({
        where: { id: automationId },
        data: {
          lastRunAt: new Date(),
          nextRunAt: nextRunAt ?? undefined,
        },
      });

      this.realtime.emitAutomationRunUpdated(automationId, {
        runId: run.id,
        status: 'done',
        resultSummary,
      });

      return this.prisma.automationRun.findUniqueOrThrow({
        where: { id: run.id },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          resultSummary: message,
          traceJson: trace as Prisma.InputJsonValue,
        },
      });
      this.realtime.emitAutomationRunUpdated(automationId, {
        runId: run.id,
        status: 'failed',
        error: message,
      });
      throw err;
    }
  }
}
