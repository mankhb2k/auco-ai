import { CompareService } from './compare.service';
import type { TaskRunsService } from '../../planning/service/task-runs.service';

describe('CompareService', () => {
  const taskRuns = { create: jest.fn() } as unknown as TaskRunsService;
  let service: CompareService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CompareService(taskRuns);
  });

  it('runs multi then single and returns verdict', async () => {
    const now = new Date();
    const multiTask = {
      id: 'm1',
      status: 'done',
      createdAt: now,
      updatedAt: new Date(now.getTime() + 100),
      steps: [
        { id: 's1', agentRole: 'credit', status: 'done', toolCalls: [] },
        { id: 's2', agentRole: 'legal', status: 'done', toolCalls: [] },
      ],
      finalAnswer: 'multi answer',
      planJson: { steps: [{}, {}] },
    };
    const singleTask = {
      id: 's1',
      status: 'done',
      createdAt: now,
      updatedAt: new Date(now.getTime() + 200),
      steps: [
        { id: 'b1', agentRole: 'credit', status: 'done', toolCalls: [{}, {}] },
      ],
      finalAnswer: 'single answer',
      planJson: { steps: [{}], baseline: true },
    };
    (taskRuns.create as jest.Mock)
      .mockResolvedValueOnce(multiTask)
      .mockResolvedValueOnce(singleTask);

    const result = await service.runCompare({
      goal: 'So sánh multi vs single',
      bankCode: 'SHB',
    });

    expect(taskRuns.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ mode: 'multi', skipApprovalPropose: true }),
    );
    expect(result.multi.mode).toBe('multi');
    expect(result.single.mode).toBe('single');
    expect(result.verdict).toBeTruthy();
  });

  it('defaults bankCode to SHB', async () => {
    const task = {
      id: 't',
      status: 'done',
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [],
      finalAnswer: '',
      planJson: { steps: [] },
    };
    (taskRuns.create as jest.Mock).mockResolvedValue(task);
    const result = await service.runCompare({ goal: '  hello  ' });
    expect(result.bankCode).toBe('SHB');
    expect(result.goal).toBe('hello');
  });
});
