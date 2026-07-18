import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationRunnerService } from './automation-runner.service';
import { computeNextRunAt } from './cron.util';

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: AutomationRunnerService,
  ) {}

  list(bankCode = 'SHB') {
    return this.prisma.automation.findMany({
      where: { bankCode },
      orderBy: { createdAt: 'desc' },
      include: {
        runs: {
          take: 3,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            resultSummary: true,
          },
        },
      },
    });
  }

  async get(id: string) {
    const auto = await this.prisma.automation.findUnique({
      where: { id },
      include: {
        runs: { orderBy: { startedAt: 'desc' }, take: 20 },
      },
    });
    if (!auto) throw new NotFoundException(`Automation ${id} not found`);
    return auto;
  }

  async patch(
    id: string,
    body: {
      enabled?: boolean;
      cronExpr?: string;
      status?: string;
      name?: string;
      description?: string;
    },
  ) {
    const auto = await this.prisma.automation.findUnique({ where: { id } });
    if (!auto) throw new NotFoundException(`Automation ${id} not found`);

    const enabled =
      body.enabled !== undefined ? body.enabled : auto.enabled;
    const cronExpr =
      body.cronExpr !== undefined ? body.cronExpr : auto.cronExpr;

    let status = body.status ?? auto.status;
    if (body.enabled === true) {
      status = 'active';
    } else if (body.enabled === false && auto.status === 'active') {
      status = 'paused';
    }

    const nextRunAt =
      enabled && cronExpr
        ? computeNextRunAt(cronExpr, auto.timezone)
        : null;

    return this.prisma.automation.update({
      where: { id },
      data: {
        enabled,
        cronExpr,
        status,
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        nextRunAt,
      },
    });
  }

  async runNow(id: string, actorId?: string) {
    const auto = await this.prisma.automation.findUnique({ where: { id } });
    if (!auto) throw new NotFoundException(`Automation ${id} not found`);
    if (!auto.graphJson) {
      throw new BadRequestException('Automation has no pinned graphJson');
    }
    return this.runner.run(id, {
      trigger: 'manual',
      actorId: actorId ?? 'demo-user',
    });
  }

  listRuns(id: string, limit = 20) {
    return this.prisma.automationRun.findMany({
      where: { automationId: id },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 50),
    });
  }
}
