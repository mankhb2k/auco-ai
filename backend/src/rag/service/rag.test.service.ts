import { RagService } from './rag.service';
import type { EmbeddingsService } from '../embeddings/service/embeddings.service';
import type { IngestService } from './ingest.service';
import type { RetrieveService } from './retrieve.service';

describe('RagService', () => {
  const ingest = {
    chunkCount: jest.fn(),
    ingestAll: jest.fn(),
  } as unknown as IngestService;
  const retrieve = { retrieve: jest.fn() } as unknown as RetrieveService;
  const embeddings = {
    provider: 'none',
    isConfigured: false,
    dimensions: 1536,
  } as unknown as EmbeddingsService;

  let service: RagService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RagService(ingest, retrieve, embeddings);
  });

  it('status reports embedding provider', () => {
    expect(service.status()).toEqual({
      suite: 'RAG',
      embeddingProvider: 'none',
      embeddingConfigured: false,
      dimensions: 1536,
    });
  });

  it('kbTool maps legal_kb_search to legal domain', async () => {
    (retrieve.retrieve as jest.Mock).mockResolvedValue({
      hits: [],
      mode: 'empty',
    });
    const result = await service.kbTool('legal_kb_search', {
      query: 'Thông tư 39',
      bankCode: 'SHB',
    });
    expect(retrieve.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'legal',
        query: 'Thông tư 39',
        bankCode: 'SHB',
      }),
    );
    expect(result.domain).toBe('legal');
    expect(result.mutates).toBe(false);
    expect(result.summary).toContain('Không tìm thấy');
  });

  it('search delegates to retrieve', async () => {
    (retrieve.retrieve as jest.Mock).mockResolvedValue({
      hits: [{ sourceDoc: 'doc-1' }],
      mode: 'fts',
    });
    const result = await service.search({
      domain: 'product',
      query: 'home loan',
    });
    expect(result.mode).toBe('fts');
    expect(result.hits).toHaveLength(1);
  });
});
