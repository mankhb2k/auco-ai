import { RetrieveService } from './retrieve.service';
import type { EmbeddingsService } from '../embeddings/service/embeddings.service';
import type { PrismaService } from '../../prisma/service/prisma.service';

describe('RetrieveService', () => {
  const prisma = {
    $queryRawUnsafe: jest.fn(),
    documentRelation: { findMany: jest.fn() },
  } as unknown as PrismaService;
  const embeddings = { embedOne: jest.fn() } as unknown as EmbeddingsService;
  let service: RetrieveService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RetrieveService(prisma, embeddings);
  });

  it('returns empty mode for blank query', async () => {
    const result = await service.retrieve({
      domain: 'legal',
      query: '   ',
    });
    expect(result).toEqual({ hits: [], mode: 'empty' });
    expect(embeddings.embedOne).not.toHaveBeenCalled();
  });

  it('falls back when embedding is null', async () => {
    (embeddings.embedOne as jest.Mock).mockResolvedValue(null);
    (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);
    (prisma.documentRelation.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.retrieve({
      domain: 'credit',
      query: 'LTV vay nhà',
      bankCode: 'SHB',
      limit: 3,
    });
    expect(result.mode === 'fts' || result.mode === 'empty').toBe(true);
    expect(result.hits).toEqual([]);
  });
});
