import { z } from 'zod';
import type { PrismaService } from '../../prisma/service/prisma.service';
import type { RetrieveService } from '../../rag/service/retrieve.service';
import type { RagDomain } from '../../rag/indexes';
import {
  ChangeProposalPayloadSchema,
  type ChangeProposalPayload,
  type KnowledgeOperation,
} from '../schemas/change-proposal.schema';

/** Zod input schemas for Curator tools (Vercel AI SDK `tool()` compatible). */
export const CuratorToolSchemas = {
  parse_source: z.object({
    rawText: z.string().min(1),
    sourceUri: z.string().nullable().optional(),
    fileName: z.string().nullable().optional(),
  }),
  kb_search: z.object({
    domain: z.enum(['credit', 'legal', 'product', 'ops']),
    query: z.string().min(1),
    bankCode: z.string().default('SHB'),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  list_active_documents: z.object({
    domain: z.enum(['credit', 'legal', 'product', 'ops']),
    bankCode: z.string().default('SHB'),
    includeSuperseded: z.boolean().default(false),
  }),
  get_document: z.object({
    docId: z.string().min(1),
    bankCode: z.string().default('SHB'),
  }),
  diff_sections: z.object({
    sourceText: z.string().min(1),
    targetText: z.string().min(1),
  }),
  propose_operations: ChangeProposalPayloadSchema,
  flag_warnings: z.object({
    warnings: z.array(z.string()),
  }),
  attach_relation: z.object({
    fromTitle: z.string().min(1),
    toDocId: z.string().min(1),
    relationType: z.enum(['amends', 'supersedes', 'replaces_clause']),
    note: z.string().nullable().optional(),
  }),
} as const;

export type ParsedSource = {
  title: string;
  sections: Array<{ heading: string; body: string }>;
  metadata: {
    documentCode: string | null;
    effectiveHint: string | null;
    sourceUri: string | null;
    fileName: string | null;
  };
  normalizedText: string;
};

export type DiffResult = {
  added: string[];
  removed: string[];
  changed: Array<{ before: string; after: string }>;
  similarity: number;
};

export class KnowledgeCuratorTools {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieve: RetrieveService,
  ) {}

  parse_source(input: z.infer<typeof CuratorToolSchemas.parse_source>): ParsedSource {
    const cleaned = input.rawText.replace(/\r\n/g, '\n').trim();
    const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
    const title =
      lines.find((l) => l.length > 8 && l.length < 160)?.slice(0, 160) ??
      input.fileName?.replace(/\.[^.]+$/, '') ??
      'Tài liệu tri thức mới';

    const codeMatch = cleaned.match(
      /(?:Thông tư|Quyết định|SBV|TT|QĐ)[^\n]{0,40}\d{1,4}\/\d{4}[^\n]{0,40}/i,
    );
    const dateMatch = cleaned.match(
      /(?:từ|hiệu lực|áp dụng)\s*(?:ngày\s*)?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    );

    const sections: ParsedSource['sections'] = [];
    let currentHeading = 'Nội dung';
    let currentBody: string[] = [];
    for (const line of lines) {
      if (/^(điều|khoản|mục|chương)\s+\d+/i.test(line) || /^#{1,3}\s+/.test(line)) {
        if (currentBody.length) {
          sections.push({
            heading: currentHeading,
            body: currentBody.join('\n'),
          });
        }
        currentHeading = line.replace(/^#+\s*/, '');
        currentBody = [];
      } else {
        currentBody.push(line);
      }
    }
    if (currentBody.length) {
      sections.push({ heading: currentHeading, body: currentBody.join('\n') });
    }
    if (sections.length === 0) {
      sections.push({ heading: 'Nội dung', body: cleaned });
    }

    return {
      title,
      sections,
      metadata: {
        documentCode: codeMatch?.[0]?.trim() ?? null,
        effectiveHint: dateMatch?.[1] ?? null,
        sourceUri: input.sourceUri ?? null,
        fileName: input.fileName ?? null,
      },
      normalizedText: cleaned,
    };
  }

  async kb_search(input: z.infer<typeof CuratorToolSchemas.kb_search>) {
    return this.retrieve.retrieve({
      domain: input.domain,
      query: input.query,
      bankCode: input.bankCode,
      limit: input.limit,
    });
  }

  async list_active_documents(
    input: z.infer<typeof CuratorToolSchemas.list_active_documents>,
  ) {
    const statuses = input.includeSuperseded
      ? ['active', 'superseded']
      : ['active'];
    return this.prisma.knowledgeDocument.findMany({
      where: {
        bankCode: input.bankCode,
        domain: input.domain,
        status: { in: statuses },
      },
      select: {
        id: true,
        title: true,
        status: true,
        content: true,
        effectiveFrom: true,
        effectiveTo: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get_document(input: z.infer<typeof CuratorToolSchemas.get_document>) {
    const doc = await this.prisma.knowledgeDocument.findFirst({
      where: { id: input.docId, bankCode: input.bankCode },
    });
    if (!doc) return null;
    return doc;
  }

  diff_sections(
    input: z.infer<typeof CuratorToolSchemas.diff_sections>,
  ): DiffResult {
    const sourceParas = splitParas(input.sourceText);
    const targetParas = splitParas(input.targetText);
    const sourceSet = new Set(sourceParas);
    const targetSet = new Set(targetParas);

    const added = sourceParas.filter((p) => !targetSet.has(p));
    const removed = targetParas.filter((p) => !sourceSet.has(p));

    const changed: DiffResult['changed'] = [];
    for (const before of removed.slice(0, 8)) {
      const after = added.find(
        (a) => tokenOverlap(a, before) > 0.35 && a !== before,
      );
      if (after) {
        changed.push({ before, after });
      }
    }

    const overlap = sourceParas.filter((p) => targetSet.has(p)).length;
    const denom = Math.max(sourceParas.length, targetParas.length, 1);
    const similarity = overlap / denom;

    return { added, removed, changed, similarity };
  }

  propose_operations(payload: ChangeProposalPayload): ChangeProposalPayload {
    return ChangeProposalPayloadSchema.parse(payload);
  }

  flag_warnings(input: z.infer<typeof CuratorToolSchemas.flag_warnings>) {
    return { warnings: input.warnings };
  }

  attach_relation(input: z.infer<typeof CuratorToolSchemas.attach_relation>) {
    return {
      type:
        input.relationType === 'replaces_clause'
          ? ('replaces_clause' as const)
          : ('amend_relation' as const),
      relationType: input.relationType,
      targetDocId: input.toDocId,
      title: input.fromTitle,
      relationNote: input.note ?? null,
    };
  }
}

/** Deterministic proposal when LLM unavailable — still uses tool outputs. */
export function buildHeuristicProposal(opts: {
  domain: RagDomain;
  parsed: ParsedSource;
  candidates: Array<{ id: string; title: string; content: string; status: string }>;
  diffs: Array<{ docId: string; title: string; diff: DiffResult }>;
}): ChangeProposalPayload {
  const warnings: string[] = [];
  const operations: KnowledgeOperation[] = [];
  let opIndex = 0;
  const nextId = () => `op-${++opIndex}`;

  if (!opts.parsed.metadata.effectiveHint) {
    warnings.push('Không nhận diện được ngày hiệu lực — Trưởng phòng nên bổ sung trước khi duyệt.');
  }

  const best = opts.diffs
    .slice()
    .sort((a, b) => b.diff.similarity - a.diff.similarity)[0];

  if (!best || best.diff.similarity < 0.15) {
    operations.push({
      id: nextId(),
      type: 'create_doc',
      title: opts.parsed.title,
      content: opts.parsed.normalizedText,
      selected: true,
    });
    return {
      summary: `Nguồn mới chưa khớp tài liệu đang dùng trong miền ${opts.domain}. Đề xuất tạo tài liệu mới.`,
      confidence: 0.55,
      warnings,
      operations,
    };
  }

  if (best.diff.similarity >= 0.92 && best.diff.added.length === 0 && best.diff.removed.length === 0) {
    operations.push({
      id: nextId(),
      type: 'noop',
      title: best.title,
      targetDocId: best.docId,
      selected: true,
    });
    return {
      summary: `Nguồn trùng với «${best.title}» — không cần cập nhật chỉ mục.`,
      confidence: 0.9,
      warnings,
      operations,
    };
  }

  if (best.diff.similarity >= 0.35 && (best.diff.added.length > 0 || best.diff.changed.length > 0)) {
    const afterExcerpt =
      best.diff.changed[0]?.after ??
      best.diff.added[0] ??
      opts.parsed.normalizedText.slice(0, 280);
    const beforeExcerpt =
      best.diff.changed[0]?.before ??
      best.diff.removed[0] ??
      null;

    const looksLikeReplacement =
      best.diff.removed.length >= 2 ||
      /thay thế|sửa đổi|bãi bỏ|supersede/i.test(opts.parsed.normalizedText);

    if (looksLikeReplacement) {
      operations.push({
        id: nextId(),
        type: 'supersede_doc',
        title: opts.parsed.title,
        content: opts.parsed.normalizedText,
        targetDocId: best.docId,
        beforeExcerpt,
        afterExcerpt,
        relationType: 'supersedes',
        relationNote: `Thay thế «${best.title}» theo nguồn tải lên`,
        selected: true,
      });
      warnings.push(
        `Nghi ngờ thay thế toàn phần «${best.title}» — kiểm tra trước khi chấp thuận.`,
      );
    } else {
      operations.push({
        id: nextId(),
        type: 'patch_doc',
        title: best.title,
        content: opts.parsed.normalizedText,
        targetDocId: best.docId,
        beforeExcerpt,
        afterExcerpt,
        selected: true,
      });
      operations.push({
        id: nextId(),
        type: 'amend_relation',
        title: opts.parsed.title,
        targetDocId: best.docId,
        relationType: 'amends',
        relationNote: 'Nguồn mới sửa đổi điều khoản của tài liệu đang dùng',
        selected: true,
      });
    }

    return {
      summary: `Đối chiếu nguồn với «${best.title}» (độ giống ${(best.diff.similarity * 100).toFixed(0)}%). Đề xuất cập nhật có kiểm soát.`,
      confidence: Math.min(0.85, 0.4 + best.diff.similarity * 0.5),
      warnings,
      operations,
    };
  }

  operations.push({
    id: nextId(),
    type: 'create_doc',
    title: opts.parsed.title,
    content: opts.parsed.normalizedText,
    selected: true,
  });
  if (best) {
    operations.push({
      id: nextId(),
      type: 'amend_relation',
      title: opts.parsed.title,
      targetDocId: best.docId,
      relationType: 'amends',
      relationNote: `Liên quan tới «${best.title}»`,
      selected: false,
    });
  }

  return {
    summary: `Nguồn có liên quan yếu tới KB hiện tại. Đề xuất tạo tài liệu mới trong miền ${opts.domain}.`,
    confidence: 0.5,
    warnings,
    operations,
  };
}

function splitParas(text: string): string[] {
  return text
    .split(/\n{2,}|\.\s+(?=[A-ZÀ-Ỹ0-9])/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 20);
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}
