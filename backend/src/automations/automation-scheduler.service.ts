import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationRunnerService } from './automation-runner.service';

const SCAN_MS = 30_000;

/** Lightweight cron scan — BullMQ optional later; Redis already in stack. */
@Injectable()
export class AutomationSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AutomationSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: AutomationRunnerService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, SCAN_MS);
    this.logger.log(`Automation scheduler scanning every ${SCAN_MS / 1000}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = await this.prisma.automation.findMany({
        where: {
          enabled: true,
          status: 'active',
          nextRunAt: { lte: new Date() },
        },
        take: 5,
        orderBy: { nextRunAt: 'asc' },
      });
      for (const auto of due) {
        this.logger.log(`Scheduler due: ${auto.id} (${auto.name})`);
        try {
          await this.runner.run(auto.id, { trigger: 'schedule', actorId: 'scheduler' });
        } catch (err) {
          this.logger.warn(
            `Scheduler run failed ${auto.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } finally {
      this.ticking = false;
    }
  }
}
