import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { liveRetrievability } from '../fsrs.util.js';
import { findItemMemoryState } from '../scheduler.repository.js';

/**
 * The prediction-vs-outcome log (Doc 2 B4: "log every prediction-vs-outcome").
 * Each review event records what FSRS predicted the chance of recall was at
 * the moment of answering, beside what actually happened - the data scheduler
 * accuracy is measured from.
 */

const DAY_S = 24 * 60 * 60;

interface SeededItem {
  knowledgeItemId: string;
  renderingId: string;
  correctOptionIndex: number;
  optionCount: number;
}

let items: SeededItem[];

beforeAll(async () => {
  const renderings = await prisma.rendering.findMany({
    where: {
      role: 'BASE',
      knowledgeItem: { objective: { topic: { module: { qualification: { slug: 'demo-cert' } } } } },
    },
  });
  if (renderings.length < 2) {
    throw new Error('Seed data missing - run `pnpm --filter @ogwi/api run db:test:setup` first');
  }

  items = renderings.map((rendering) => {
    const content = rendering.content as { options: string[]; correctOptionIndex: number };
    return {
      knowledgeItemId: rendering.knowledgeItemId,
      renderingId: rendering.id,
      correctOptionIndex: content.correctOptionIndex,
      optionCount: content.options.length,
    };
  });
});

const demoLearner = () => `demo-test-${randomUUID()}`;

function answer(learnerId: string, item: SeededItem, correct: boolean) {
  const selectedOptionIndex = correct
    ? item.correctOptionIndex
    : (item.correctOptionIndex + 1) % item.optionCount;

  return request(createApp())
    .post('/api/scheduler/answers')
    .set('x-dev-learner-id', learnerId)
    .send({
      attemptId: randomUUID(),
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: { kind: 'option_index', selectedOptionIndex },
    });
}

function advanceClock(learnerId: string, seconds: number) {
  return request(createApp())
    .post('/api/dev/clock/advance')
    .set('x-dev-learner-id', learnerId)
    .send({ seconds });
}

describe('prediction-vs-outcome log', () => {
  it('records no prediction for a first-ever answer', async () => {
    const learnerId = randomUUID();

    expect((await answer(learnerId, items[0]!, true)).status).toBe(200);

    const event = await prisma.reviewEvent.findFirstOrThrow({ where: { learnerId } });
    // Null, not 0: FSRS has no prediction for a card it has never scheduled,
    // and a 0 would read as a confident prediction of failure.
    expect(event.predictedRetrievability).toBeNull();
  });

  it("records FSRS's prediction at the moment of answering, beside the outcome", async () => {
    const learnerId = demoLearner();
    const item = items[0]!;

    await answer(learnerId, item, true);
    const stateBefore = await findItemMemoryState(learnerId, item.knowledgeItemId);
    await advanceClock(learnerId, DAY_S);
    await answer(learnerId, item, false);

    const event = await prisma.reviewEvent.findFirstOrThrow({ where: { learnerId, grade: 'AGAIN' } });
    const predicted = event.predictedRetrievability as number;

    expect(predicted).toBeGreaterThan(0);
    expect(predicted).toBeLessThan(1);
    // Exactly what FSRS computed from the pre-answer state, at the (advanced)
    // instant the answer was stamped with.
    expect(predicted).toBeCloseTo(liveRetrievability(stateBefore, event.reviewedAt), 10);
  });

  it('serves the log newest first, with source and outcome', async () => {
    const learnerId = demoLearner();
    const item = items[0]!;

    await answer(learnerId, item, true);
    await advanceClock(learnerId, DAY_S);
    await answer(learnerId, item, false);

    const res = await request(createApp())
      .get('/api/scheduler/review-log')
      .query({ qualificationSlug: 'demo-cert' })
      .set('x-dev-learner-id', learnerId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      knowledgeItemId: item.knowledgeItemId,
      source: 'practice',
      outcome: 'incorrect',
    });
    expect(res.body[0].predictedRetrievability).toBeGreaterThan(0);
    expect(res.body[1]).toMatchObject({
      source: 'practice',
      outcome: 'correct',
      predictedRetrievability: null,
    });
  });

  it('records the prediction for exam answers too', async () => {
    const learnerId = randomUUID();
    // Every item seen once first, so each exam answer has a prediction to record.
    for (const item of items) await answer(learnerId, item, true);

    const start = await request(createApp())
      .post('/api/exam/runs')
      .set('x-dev-learner-id', learnerId)
      .send({ qualificationSlug: 'demo-cert' });
    expect(start.status).toBe(201);
    const { runId } = start.body as { runId: string };

    const paper = await request(createApp()).get(`/api/exam/runs/${runId}`).set('x-dev-learner-id', learnerId);
    for (const question of paper.body.questions as { knowledgeItemId: string }[]) {
      await request(createApp())
        .post(`/api/exam/runs/${runId}/answers`)
        .set('x-dev-learner-id', learnerId)
        .send({ knowledgeItemId: question.knowledgeItemId, selectedOptionIndex: 0 });
    }

    const submit = await request(createApp())
      .post(`/api/exam/runs/${runId}/submit`)
      .set('x-dev-learner-id', learnerId);
    expect(submit.status).toBe(200);

    const examEvents = await prisma.reviewEvent.findMany({
      where: { learnerId, idempotencyKey: { startsWith: 'exam-item:' } },
    });
    expect(examEvents.length).toBeGreaterThan(0);
    for (const event of examEvents) {
      expect(event.predictedRetrievability).not.toBeNull();
      expect(event.predictedRetrievability as number).toBeGreaterThan(0);
      expect(event.predictedRetrievability as number).toBeLessThanOrEqual(1);
    }
  });
});
