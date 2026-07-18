import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import type { PrismaService } from '../../prisma/service/prisma.service';
import type { IngestService } from '../../rag/service/ingest.service';

describe('KnowledgeService', () => {
  const prisma = {
    knowledgeDocument: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
  const ingest = {
    ingestAll: jest.fn(),
  } as unknown as IngestService;

  const actor = { id: 'emp-mgr-d', bankCode: 'SHB' };
  const draft = {
    id: 'doc-draft',
    bankCode: 'SHB',
    domain: 'credit',
    title: 'Chính sách LTV 2026',
    content: 'LTV tối đa 70%.',
    sourceUrl: null,
    status: 'draft',
    effectiveFrom: null,
    effectiveTo: null,
    uploadedById: actor.id,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let service: KnowledgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KnowledgeService(prisma, ingest);
  });

  it('lists documents filtered by bank, domain and status', async () => {
    (prisma.knowledgeDocument.findMany as jest.Mock).mockResolvedValue([]);

    await service.list({
      bankCode: 'SHB',
      domain: 'credit',
      status: 'draft',
    });

    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bankCode: 'SHB', domain: 'credit', status: 'draft' },
      }),
    );
  });

  it('rejects invalid list domain', () => {
    expect(() => service.list({ domain: 'marketing' })).toThrow(
      BadRequestException,
    );
  });

  it('creates a draft owned by manager bank', async () => {
    (prisma.knowledgeDocument.create as jest.Mock).mockResolvedValue(draft);

    const result = await service.createDraft(
      {
        title: ' Chính sách LTV 2026 ',
        domain: 'credit',
        content: ' LTV tối đa 70%. ',
      },
      actor,
    );

    expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Chính sách LTV 2026',
        domain: 'credit',
        content: 'LTV tối đa 70%.',
        bankCode: 'SHB',
        uploadedById: 'emp-mgr-d',
        status: 'draft',
      }),
    });
    expect(result).toBe(draft);
  });

  it('rejects draft with invalid domain', () => {
    expect(() =>
      service.createDraft(
        {
          title: 'Doc',
          domain: 'marketing',
          content: 'Content',
        },
        actor,
      ),
    ).toThrow(BadRequestException);
  });

  it('updates draft fields', async () => {
    (prisma.knowledgeDocument.findFirst as jest.Mock).mockResolvedValue(draft);
    (prisma.knowledgeDocument.update as jest.Mock).mockResolvedValue({
      ...draft,
      title: 'LTV mới',
    });

    const result = await service.updateDraft(
      draft.id,
      { title: ' LTV mới ' },
      'SHB',
    );

    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith({
      where: { id: draft.id },
      data: { title: 'LTV mới' },
    });
    expect(result.title).toBe('LTV mới');
  });

  it('cannot edit an active document', async () => {
    (prisma.knowledgeDocument.findFirst as jest.Mock).mockResolvedValue({
      ...draft,
      status: 'active',
    });

    await expect(
      service.updateDraft(draft.id, { title: 'No' }, 'SHB'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publishes draft and rebuilds active index', async () => {
    (prisma.knowledgeDocument.findFirst as jest.Mock).mockResolvedValue(draft);
    const active = {
      ...draft,
      status: 'active',
      publishedAt: new Date(),
      effectiveFrom: new Date(),
    };
    (prisma.knowledgeDocument.update as jest.Mock).mockResolvedValue(active);
    (ingest.ingestAll as jest.Mock).mockResolvedValue({
      docs: 2,
      chunks: 4,
      embedded: 4,
      provider: 'openai',
    });

    const result = await service.publish(draft.id, 'SHB');

    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith({
      where: { id: draft.id },
      data: expect.objectContaining({
        status: 'active',
        publishedAt: expect.any(Date),
        effectiveFrom: expect.any(Date),
      }),
    });
    expect(ingest.ingestAll).toHaveBeenCalledWith({ bankCode: 'SHB' });
    expect(result.document.status).toBe('active');
  });

  it('rolls document back to draft when ingest fails', async () => {
    (prisma.knowledgeDocument.findFirst as jest.Mock).mockResolvedValue(draft);
    (prisma.knowledgeDocument.update as jest.Mock)
      .mockResolvedValueOnce({ ...draft, status: 'active' })
      .mockResolvedValueOnce(draft);
    (ingest.ingestAll as jest.Mock).mockRejectedValue(
      new Error('embedding unavailable'),
    );

    await expect(service.publish(draft.id, 'SHB')).rejects.toThrow(
      'embedding unavailable',
    );
    expect(prisma.knowledgeDocument.update).toHaveBeenNthCalledWith(2, {
      where: { id: draft.id },
      data: {
        status: 'draft',
        publishedAt: null,
        effectiveFrom: null,
      },
    });
  });

  it('throws NotFound for unknown document', async () => {
    (prisma.knowledgeDocument.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.get('missing', 'SHB')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
