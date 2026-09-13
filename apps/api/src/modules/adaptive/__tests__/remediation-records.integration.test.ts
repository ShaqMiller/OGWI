import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * GET /api/adaptive/remediation-records - the remediation record (Doc 2 B3),
 * walked through its exit rule over HTTP with the test clock, exactly as the
 * demo does it.
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
const wrongOption = (item: SeededItem) => (item.correctOptionIndex + 1) % item.optionCount;

function answer(learnerId: string, item: SeededItem, correct: boolean) {
  return request(createApp())
    .post('/api/scheduler/answers')
    .set('x-dev-learner-id', learnerId)
    .send({
      attemptId: randomUUID(),
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: {
        kind: 'option_index',
        selectedOptionIndex: correct ? item.correctOptionIndex : wrongOption(item),
      },
    });
}

function advanceClock(learnerId: string, seconds: number) {
  return request(createApp())
    .post('/api/dev/clock/advance')
    .set('x-dev-learner-id', learnerId)
    .send({ seconds });
}

async function recordsFor(learnerId: string) {
  const res = await request(createApp())
    .get('/api/adaptive/remediation-records')
    .query({ qualificationSlug: 'demo-cert' })
    .set('x-dev-learner-id', learnerId);

  expect(res.status).toBe(200);
  return res.body as Record<string, unknown>[];
}

describe('GET /api/adaptive/remediation-records', () => {
  it('is empty for a learner who has never missed', async () => {
    const learnerId = randomUUID();
    await answer(learnerId, items[0]!, true);

    expect(await recordsFor(learnerId)).toEqual([]);
  });

  it('walks one missed item out of remediation, a day at a time', async () => {
    const learnerId = demoLearner();
    const item = items[0]!;

    // The deliberate miss.
    await answer(learnerId, item, false);
    let [record] = await recordsFor(learnerId);
    expect(record).toMatchObject({
      knowledgeItemId: item.knowledgeItemId,
      status: 'in_remediation',
      source: 'practice',
      againCount: 1,
      qualifyingAnswers: [],
      correctAnswersRequired: 2,
      correctAnswersNeeded: 2,
      exitedAt: null,
      rung: null,
    });
    // A correct answer would count straight away.
    expect(record!.nextQualifyingFrom).toBe(record!.enteredAt);

    // One correct answer counts...
    await answer(learnerId, item, true);
    [record] = await recordsFor(learnerId);
    expect(record!.correctAnswersNeeded).toBe(1);
    const countedAt = new Date((record!.qualifyingAnswers as { reviewedAt: string }[])[0]!.reviewedAt);
    const startOfNextDay = new Date(
      Date.UTC(countedAt.getUTCFullYear(), countedAt.getUTCMonth(), countedAt.getUTCDate() + 1),
    );
    expect(record!.nextQualifyingFrom).toBe(startOfNextDay.toISOString());

    // ...a second on the same day doesn't...
    await answer(learnerId, item, true);
    [record] = await recordsFor(learnerId);
    expect(record!.correctAnswersNeeded).toBe(1);

    // ...and one the next day exits.
    await advanceClock(learnerId, DAY_S);
    await answer(learnerId, item, true);
    [record] = await recordsFor(learnerId);
    expect(record).toMatchObject({
      status: 'exited',
      correctAnswersNeeded: 0,
      nextQualifyingFrom: null,
    });
    expect(record!.exitedAt).not.toBeNull();
    expect(record!.qualifyingAnswers).toHaveLength(2);
  });

  it('names an exam as the source of a miss made in one', async () => {
    const learnerId = randomUUID();
    const byItem = new Map(items.map((item) => [item.knowledgeItemId, item]));

    const start = await request(createApp())
      .post('/api/exam/runs')
      .set('x-dev-learner-id', learnerId)
      .send({ qualificationSlug: 'demo-cert' });
    const { runId } = start.body as { runId: string };

    const paper = await request(createApp()).get(`/api/exam/runs/${runId}`).set('x-dev-learner-id', learnerId);
    for (const question of paper.body.questions as { knowledgeItemId: string }[]) {
      await request(createApp())
        .post(`/api/exam/runs/${runId}/answers`)
        .set('x-dev-learner-id', learnerId)
        .send({
          knowledgeItemId: question.knowledgeItemId,
          selectedOptionIndex: wrongOption(byItem.get(question.knowledgeItemId)!),
        });
    }
    await request(createApp()).post(`/api/exam/runs/${runId}/submit`).set('x-dev-learner-id', learnerId);

    const records = await recordsFor(learnerId);
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.source === 'exam')).toBe(true);
  });
});
