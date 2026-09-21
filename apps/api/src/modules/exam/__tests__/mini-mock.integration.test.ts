import { randomUUID } from 'node:crypto';
import {
  MINI_MOCK_SECONDS_PER_QUESTION,
  MINI_MOCK_TARGET_QUESTION_COUNT,
  PREMIUM_MINI_MOCK,
} from '@ogwi/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { examRunPremiumKey } from '../../scheduler/idempotency.util.js';

/**
 * The mini-mock (Doc 2 B2: "10-20 questions, ~10 minutes") - a short paper
 * that counts as exam evidence for readiness, pays its own premium, and is the
 * checklist's route to a first score.
 */

let correctByItem: Map<string, number>;

beforeAll(async () => {
  const renderings = await prisma.rendering.findMany({
    where: {
      role: 'BASE',
      knowledgeItem: { objective: { topic: { module: { qualification: { slug: 'demo-cert' } } } } },
    },
  });
  correctByItem = new Map(
    renderings.map((rendering) => [
      rendering.knowledgeItemId,
      (rendering.content as { correctOptionIndex: number }).correctOptionIndex,
    ]),
  );
});

async function startMiniMock(learnerId: string) {
  const res = await request(createApp())
    .post('/api/exam/runs')
    .set('x-dev-learner-id', learnerId)
    .send({ qualificationSlug: 'demo-cert', kind: 'MINI_MOCK' });
  expect(res.status).toBe(201);
  return res.body as { runId: string; questionCount: number; allottedSeconds: number; kind: string };
}

async function sitAndSubmit(learnerId: string, runId: string) {
  const paper = await request(createApp()).get(`/api/exam/runs/${runId}`).set('x-dev-learner-id', learnerId);
  for (const question of paper.body.questions as { knowledgeItemId: string }[]) {
    await request(createApp())
      .post(`/api/exam/runs/${runId}/answers`)
      .set('x-dev-learner-id', learnerId)
      .send({ knowledgeItemId: question.knowledgeItemId, selectedOptionIndex: correctByItem.get(question.knowledgeItemId) });
  }
  const submit = await request(createApp()).post(`/api/exam/runs/${runId}/submit`).set('x-dev-learner-id', learnerId);
  expect(submit.status).toBe(200);
  return { paper: paper.body, results: submit.body };
}

describe('mini-mock', () => {
  it('builds a short paper, timed at about 40 seconds a question', async () => {
    const run = await startMiniMock(randomUUID());
    const expectedCount = Math.min(MINI_MOCK_TARGET_QUESTION_COUNT, correctByItem.size);

    expect(run.kind).toBe('MINI_MOCK');
    expect(run.questionCount).toBe(expectedCount);
    expect(run.allottedSeconds).toBe(expectedCount * MINI_MOCK_SECONDS_PER_QUESTION);

    const stored = await prisma.examRun.findUniqueOrThrow({ where: { id: run.runId } });
    expect(stored.kind).toBe('MINI_MOCK');
  });

  it('still starts a full exam simulation when no kind is given', async () => {
    const res = await request(createApp())
      .post('/api/exam/runs')
      .set('x-dev-learner-id', randomUUID())
      .send({ qualificationSlug: 'demo-cert' });

    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('SIMULATION');
  });

  it('refuses a kind a learner cannot start', async () => {
    const res = await request(createApp())
      .post('/api/exam/runs')
      .set('x-dev-learner-id', randomUUID())
      .send({ qualificationSlug: 'demo-cert', kind: 'CUSTOM' });

    expect(res.status).toBe(400);
  });

  it("names itself on the paper and results, and pays the mini-mock premium", async () => {
    const learnerId = randomUUID();
    const { runId } = await startMiniMock(learnerId);
    const { paper, results } = await sitAndSubmit(learnerId, runId);

    expect(paper.kind).toBe('MINI_MOCK');
    expect(results.kind).toBe('MINI_MOCK');

    const premium = await prisma.litreEvent.findUnique({ where: { idempotencyKey: examRunPremiumKey(runId) } });
    expect(premium?.amount).toBe(PREMIUM_MINI_MOCK);
  });

  it('counts as exam evidence for readiness: it ticks the checklist and calibrates', async () => {
    const learnerId = randomUUID();
    const { runId } = await startMiniMock(learnerId);
    await sitAndSubmit(learnerId, runId);

    const view = await request(createApp()).get('/api/readiness/demo-cert').set('x-dev-learner-id', learnerId);
    const examItem = view.body.checklist.items.find((item: { key: string }) => item.key === 'first_exam_run');

    expect(examItem.done).toBe(true);
    // Submitting was a publish point, so the run is already behind the published number.
    expect(view.body.published.breakdown.calibrationRuns).toHaveLength(1);
  });
});
