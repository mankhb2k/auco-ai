import { BadRequestException } from '@nestjs/common';
import type { AuditService } from '../../audit/service/audit.service';
import type { PrismaService } from '../../prisma/service/prisma.service';
import type { IngestService } from '../../rag/service/ingest.service';
import type { KnowledgeCuratorService } from './knowledge-curator.service';
import { KnowledgeIngestService } from './knowledge-ingest.service';

describe('KnowledgeIngestService', () => {
  const prisma = {
    knowledgeIngestJob: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    knowledgeChangeProposal: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    knowledgeDocument: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    documentRelation: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const curator = {
    analyzeJob: jest.fn(),
  } as unknown as KnowledgeCuratorService;

  const ingest = {
    ingestAll: jest.fn(),
  } as unknown as IngestService;

  const audit = { recordSafe: jest.fn() } as unknown as AuditService;

  let service: KnowledgeIngestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KnowledgeIngestService(prisma, curator, ingest, audit);
  });

  it('createJob requires rawText for upload', async () => {
    await expect(
      service.createJob(
        {
          domain: 'credit',
          sourceType: 'upload',
        } as never,
        { id: 'emp-mgr-d', bankCode: 'SHB' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createJob runs curator and returns job with proposal', async () => {
    (prisma.knowledgeIngestJob.create as jest.Mock).mockResolvedValue({
      id: 'job-1',
      domain: 'credit',
      sourceType: 'upload',
      fileName: 'ltv.txt',
    });
    (curator.analyzeJob as jest.Mock).mockResolvedValue({
      jobId: 'job-1',
      proposalId: 'prop-1',
      status: 'pending_review',
    });
    (prisma.knowledgeIngestJob.findFirst as jest.Mock).mockResolvedValue({
      id: 'job-1',
      status: 'pending_review',
      proposal: { id: 'prop-1' },
    });

    const result = await service.createJob(
      {
        domain: 'credit',
        sourceType: 'upload',
        fileName: 'ltv.txt',
        rawText: 'Chính sách LTV nhà xưởng 2026. LTV tối đa 75%.',
      },
      { id: 'emp-mgr-d', bankCode: 'SHB' },
    );

    expect(curator.analyzeJob).toHaveBeenCalledWith('job-1');
    expect(result.id).toBe('job-1');
    expect(audit.recordSafe).toHaveBeenCalled();
  });

  it('approve applies create_doc then ingestAll', async () => {
    (prisma.knowledgeChangeProposal.findFirst as jest.Mock).mockResolvedValue({
      id: 'prop-1',
      jobId: 'job-1',
      bankCode: 'SHB',
      domain: 'credit',
      status: 'pending_review',
      operationsJson: [
        {
          id: 'op-1',
          type: 'create_doc',
          title: 'LTV mới',
          content: 'LTV 75%',
          selected: true,
        },
      ],
      job: { sourceUri: null },
    });
    (prisma.knowledgeDocument.create as jest.Mock).mockResolvedValue({
      id: 'doc-new',
    });
    (ingest.ingestAll as jest.Mock).mockResolvedValue({
      docs: 1,
      chunks: 1,
      embedded: 1,
      provider: 'openai',
    });
    (prisma.knowledgeChangeProposal.update as jest.Mock).mockResolvedValue({
      id: 'prop-1',
      status: 'approved',
      job: { id: 'job-1' },
    });
    (prisma.knowledgeIngestJob.update as jest.Mock).mockResolvedValue({});

    const result = await service.approve('prop-1', {
      id: 'emp-mgr-d',
      bankCode: 'SHB',
    });

    expect(prisma.knowledgeDocument.create).toHaveBeenCalled();
    expect(ingest.ingestAll).toHaveBeenCalledWith({ bankCode: 'SHB' });
    expect(result.appliedDocIds).toContain('doc-new');
    expect(audit.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge.proposal.approve' }),
    );
  });

  it('reject marks proposal and job rejected without ingest', async () => {
    (prisma.knowledgeChangeProposal.findFirst as jest.Mock).mockResolvedValue({
      id: 'prop-1',
      jobId: 'job-1',
      bankCode: 'SHB',
      domain: 'credit',
      status: 'pending_review',
      operationsJson: [],
      job: {},
    });
    (prisma.knowledgeChangeProposal.update as jest.Mock).mockResolvedValue({
      id: 'prop-1',
      status: 'rejected',
      job: { id: 'job-1' },
    });
    (prisma.knowledgeIngestJob.update as jest.Mock).mockResolvedValue({});

    await service.reject('prop-1', { id: 'emp-mgr-d', bankCode: 'SHB' }, {
      reviewNote: 'Chưa đủ căn cứ',
    });

    expect(ingest.ingestAll).not.toHaveBeenCalled();
    expect(audit.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge.proposal.reject' }),
    );
  });
});
