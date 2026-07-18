import { RealtimeService } from './realtime.service';
import type { RealtimeGateway } from '../realtime.gateway';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let gateway: { emitToTask: jest.Mock; emitToAutomation: jest.Mock };

  beforeEach(() => {
    service = new RealtimeService();
    gateway = { emitToTask: jest.fn(), emitToAutomation: jest.fn() };
    service.register(gateway as unknown as RealtimeGateway);
  });

  it('emitTaskUpdated forwards to gateway', () => {
    service.emitTaskUpdated('task-1', { status: 'running' });
    expect(gateway.emitToTask).toHaveBeenCalledWith('task-1', 'task.updated', {
      taskRunId: 'task-1',
      status: 'running',
    });
  });

  it('emitStepUpdated forwards to gateway', () => {
    service.emitStepUpdated('task-1', { stepId: 's1', status: 'done' });
    expect(gateway.emitToTask).toHaveBeenCalledWith('task-1', 'step.updated', {
      taskRunId: 'task-1',
      stepId: 's1',
      status: 'done',
    });
  });

  it('emitApprovalNeeded forwards to gateway', () => {
    service.emitApprovalNeeded('task-1', { stepId: 's1' });
    expect(gateway.emitToTask).toHaveBeenCalledWith(
      'task-1',
      'approval.needed',
      { taskRunId: 'task-1', stepId: 's1' },
    );
  });

  it('emitAutomationRunUpdated forwards to gateway', () => {
    service.emitAutomationRunUpdated('auto-1', {
      runId: 'r1',
      status: 'running',
    });
    expect(gateway.emitToAutomation).toHaveBeenCalledWith(
      'auto-1',
      'automation.run.updated',
      { automationId: 'auto-1', runId: 'r1', status: 'running' },
    );
  });

  it('is no-op before gateway is registered', () => {
    const bare = new RealtimeService();
    expect(() => bare.emitTaskUpdated('t', {})).not.toThrow();
  });
});
