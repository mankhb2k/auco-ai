import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type BankHqDocument = {
  id: string;
  domain: string;
  bankCode: string;
  title: string;
  sourceUrl: string | null;
  content: string;
  status: 'active' | 'superseded';
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type BankHqKnowledgeResponse = {
  meta: {
    source: string;
    endpoint: string;
    version: string;
    publishedBy: string;
    updatedAt: string;
    note: string;
  };
  documents: BankHqDocument[];
};

/**
 * Mock client cho "API tri thức chuẩn hóa" của ngân hàng (hội sở).
 * Trong demo, API này được giả lập bằng file JSON tĩnh; app chỉ đọc,
 * không bao giờ ghi ngược lại nguồn.
 */
@Injectable()
export class BankHqService {
  private readonly logger = new Logger(BankHqService.name);

  fetchKnowledge(): BankHqKnowledgeResponse {
    const file = join(
      process.cwd(),
      'data',
      'mock',
      'bank-hq-knowledge.json',
    );
    const parsed = JSON.parse(
      readFileSync(file, 'utf8'),
    ) as BankHqKnowledgeResponse;
    this.logger.log(
      `Fetched HQ knowledge v${parsed.meta.version} — ${parsed.documents.length} documents`,
    );
    return parsed;
  }
}
