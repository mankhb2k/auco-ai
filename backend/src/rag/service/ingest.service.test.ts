import { IngestService } from './ingest.service';
import type { EmbeddingsService } from '../embeddings/service/embeddings.service';
import type { PrismaService } from '../../prisma/service/prisma.service';

describe('IngestService', () => {
  const prisma = {
    knowledgeDocument: { findMany: jest.fn() },
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  } as unknown as PrismaService;
  const embeddings = {
    provider: 'none',
    embedMany: jest.fn(),
  } as unknown as EmbeddingsService;

  let service: IngestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IngestService(prisma, embeddings);
  });

  it('ingestAll returns zeros when no documents', async () => {
    (prisma.knowledgeDocument.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(undefined);

    const result = await service.ingestAll({ bankCode: 'SHB' });
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
      where: { bankCode: 'SHB', status: 'active' },
      orderBy: { id: 'asc' },
    });
    expect(result).toEqual({
      docs: 0,
      chunks: 0,
      embedded: 0,
      provider: 'none',
    });
  });
});
