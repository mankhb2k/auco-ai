import {
  buildHeuristicProposal,
  KnowledgeCuratorTools,
} from './knowledge-curator.tools';

describe('KnowledgeCuratorTools', () => {
  const prisma = {
    knowledgeDocument: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  } as never;
  const retrieve = {
    retrieve: jest.fn(),
  } as never;

  const tools = new KnowledgeCuratorTools(prisma, retrieve);

  it('parse_source extracts title and Điều sections', () => {
    const parsed = tools.parse_source({
      rawText: `Chính sách LTV 2026
Điều 1
LTV tối đa 70%.
Điều 2
Áp dụng từ 01/07/2026.`,
      fileName: 'ltv.txt',
    });
    expect(parsed.title).toContain('LTV');
    expect(parsed.sections.length).toBeGreaterThanOrEqual(2);
    expect(parsed.metadata.effectiveHint).toBeTruthy();
  });

  it('diff_sections detects added and removed paragraphs', () => {
    const diff = tools.diff_sections({
      sourceText:
        'LTV tối đa với nhà xưởng là 75 phần trăm theo hội đồng tín dụng mới.\n\nÁp dụng từ quý 3 năm 2026 cho toàn hệ thống.',
      targetText:
        'LTV tối đa với nhà xưởng là 75 phần trăm theo hội đồng tín dụng mới.\n\nÁp dụng từ quý 1 năm 2025 cho chi nhánh thí điểm.',
    });
    expect(diff.similarity).toBeGreaterThan(0);
    expect(
      diff.added.length + diff.removed.length + diff.changed.length,
    ).toBeGreaterThan(0);
  });

  it('buildHeuristicProposal suggests create_doc when no candidates', () => {
    const payload = buildHeuristicProposal({
      domain: 'credit',
      parsed: tools.parse_source({
        rawText: 'Quy trình giải ngân nội bộ hoàn toàn mới cho chi nhánh.',
      }),
      candidates: [],
      diffs: [],
    });
    expect(payload.operations.some((op) => op.type === 'create_doc')).toBe(true);
  });

  it('buildHeuristicProposal suggests noop when nearly identical', () => {
    const text =
      'Tỷ lệ cho vay tối đa trên giá trị tài sản bảo đảm đối với BĐS sản xuất kinh doanh có thể lên tới 80%.';
    const payload = buildHeuristicProposal({
      domain: 'credit',
      parsed: tools.parse_source({ rawText: text }),
      candidates: [{ id: 'd1', title: 'TT39', content: text, status: 'active' }],
      diffs: [
        {
          docId: 'd1',
          title: 'TT39',
          diff: { added: [], removed: [], changed: [], similarity: 1 },
        },
      ],
    });
    expect(payload.operations[0]?.type).toBe('noop');
  });
});
