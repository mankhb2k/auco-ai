/**
 * E2E — OpenAI thật (không mock AI SDK).
 *
 * Prereq (một lần trong auco-ai/backend):
 *   docker compose up -d
 *   npx prisma migrate deploy
 *   npx prisma db seed
 *
 * Chạy:
 *   npm run test:e2e:llm
 *
 * Thiếu OPENAI_API_KEY → suite skip (CI không key không gãy).
 * Case A/B chỉ cần Postgres boot + key. Case C cần seed + MCP.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
const d = hasKey ? describe : describe.skip;

const EMPLOYEE_HEADER = 'x-demo-employee-id';
const EMPLOYEE_ID = 'emp-credit-b';

/** Goal không dính substring pinned trong demo-plans.ts → buộc OpenAI plan. */
const GENERIC_GOAL =
  'Đánh giá rủi ro vận hành khi hệ thống thanh toán gián đoạn giờ cao điểm';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

d('LLM OpenAI e2e (real API)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('A — GET /api/llm/status exposes openai primary + tier routing', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/llm/status')
      .expect(200);

    expect(res.body.primary.provider).toBe('openai');
    expect(res.body.primary.configured).toBe(true);
    expect(res.body.tiers).toEqual(
      expect.objectContaining({
        small: expect.any(String),
        mid: expect.any(String),
        large: expect.any(String),
      }),
    );
    expect(res.body.purposeRouting.task_plan).toBe('large');
    expect(res.body.defaultTier).toBe('mid');
  });

  it('B — POST /api/llm/smoke calls OpenAI generateObject (tier=small)', async () => {
    // Nest mặc định POST → 201
    const res = await request(app.getHttpServer())
      .post('/api/llm/smoke')
      .expect(201);

    expect(res.body.status).toBe('ok');
    expect(res.body.object.ok).toBe(true);
    expect(typeof res.body.object.bankCode).toBe('string');
    expect(res.body.object.bankCode.length).toBeGreaterThan(0);
    expect(res.body.trace.provider).toBe('openai');
    expect(res.body.trace.tier).toBe('small');
    expect(res.body.trace.usedFallback).toBe(false);
  });

  it('C — POST /api/task-runs generic goal → OpenAI plan then synthesize', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/task-runs')
      .set(EMPLOYEE_HEADER, EMPLOYEE_ID)
      .send({
        goal: GENERIC_GOAL,
        mode: 'multi',
        async: true,
        skipApprovalPropose: true,
      })
      .expect(201);

    // Hard assert: OpenAI đã lập plan (không phải demo_pinned)
    expect(createRes.body.meta.planSource).toBe('llm');
    expect(createRes.body.meta.scenario).toBe('generic');
    expect(createRes.body.id).toBeTruthy();

    const taskId = createRes.body.id as string;

    // Poll tới terminal status (MCP + synthesize có thể chậm)
    const deadline = Date.now() + 90_000;
    let task: {
      status: string;
      finalAnswer?: string | null;
    } | null = null;

    while (Date.now() < deadline) {
      const getRes = await request(app.getHttpServer())
        .get(`/api/task-runs/${taskId}`)
        .set(EMPLOYEE_HEADER, EMPLOYEE_ID)
        .expect(200);

      task = getRes.body;
      if (task && (task.status === 'done' || task.status === 'failed')) {
        break;
      }
      await sleep(3_000);
    }

    expect(task).toBeTruthy();
    expect(task!.status).toBe('done');
    expect(typeof task!.finalAnswer).toBe('string');
    expect((task!.finalAnswer ?? '').trim().length).toBeGreaterThan(0);
  });
});
