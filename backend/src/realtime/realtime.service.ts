import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  private gateway: RealtimeGateway | null = null;

  register(gateway: RealtimeGateway) {
    this.gateway = gateway;
  }

  emitTaskUpdated(taskRunId: string, payload: Record<string, unknown>) {
    this.gateway?.emitToTask(taskRunId, 'task.updated', {
      taskRunId,
      ...payload,
    });
  }

  emitStepUpdated(taskRunId: string, payload: Record<string, unknown>) {
    this.gateway?.emitToTask(taskRunId, 'step.updated', {
      taskRunId,
      ...payload,
    });
  }

  emitApprovalNeeded(taskRunId: string, payload: Record<string, unknown>) {
    this.gateway?.emitToTask(taskRunId, 'approval.needed', {
      taskRunId,
      ...payload,
    });
  }

  emitAutomationRunUpdated(
    automationId: string,
    payload: Record<string, unknown>,
  ) {
    this.gateway?.emitToAutomation(automationId, 'automation.run.updated', {
      automationId,
      ...payload,
    });
  }
}
