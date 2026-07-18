import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import type { PrismaService } from '../../prisma/service/prisma.service';

describe('KnowledgeService', () => {
  const prisma = {
    knowledgeDocument: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: KnowledgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KnowledgeService(prisma);
  });

  it('lists documents filtered by bank, domain and status', async () => {
    (prisma.knowledgeDocument.findMany as jest.Mock).mockResolvedValue([]);

    await service.list({
      bankCode: 'SHB',
      domain: 'credit',
      status: 'active',
    });

    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bankCode: 'SHB', domain: 'credit', status: 'active' },
      }),
    );
  });

  it('rejects invalid list domain', () => {
    expect(() => service.list({ domain: 'marketing' })).toThrow(
      BadRequestException,
    );
  });

  it('gets a document by id and bank', async () => {
    const doc = { id: 'doc-1', bankCode: 'SHB', title: 'Demo' };
    (prisma.knowledgeDocument.findFirst as jest.Mock).mockResolvedValue(doc);
    await expect(service.get('doc-1', 'SHB')).resolves.toEqual(doc);
  });

  it('throws when document is missing', async () => {
    (prisma.knowledgeDocument.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.get('missing', 'SHB')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
