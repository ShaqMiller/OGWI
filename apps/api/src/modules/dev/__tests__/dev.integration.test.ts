import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * The test clock, end to end over HTTP - the only path the demo uses, and the
 * only one that exercises middleware/learnerClock.
 */

const HOUR_S = 60 * 60;
const DAY_S = 24 * HOUR_S;
const DAY_MS = DAY_S * 1000;
/** Slack for request latency when comparing a written timestamp to "a day from now". */
const TOLERANCE_MS = 60 * 1000;

let item: { knowledgeItemId: string; renderingId: string; correctOptionIndex: number };

beforeAll(async () => {
  const rendering = await prisma.rendering.findFirst({
    where: { role: 'BASE', knowledgeItem: { objective: { topic: { module: { qualification: { slug: 'demo-cert' } } } } } },
  });
  if (!rendering) throw new Error('Seed data missing - run `pnpm --filter @ogwi/api run db:test:setup` first');

  const content = rendering.content as { correctOptionIndex: number };
  item = {
    knowledgeItemId: rendering.knowledgeItemId,
    renderingId: rendering.id,
    correctOptionIndex: content.correctOptionIndex,
  };
});

const demoLearner = () => `demo-test-${randomUUID()}`;

function advance(learnerId: string, seconds: unknown) {
  return request(createApp())
    .post('/api/dev/clock/advance')
    .set('x-dev-learner-id', learnerId)
    .send({ seconds });
}

function answerCorrectly(learnerId: string) {
  return request(createApp())
    .post('/api/scheduler/answers')
    .set('x-dev-learner-id', learnerId)
    .send({
      attemptId: randomUUID(),
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: { kind: 'option_index', selectedOptionIndex: item.correctOptionIndex },
    });
}

function expectAboutADayAhead(date: Date) {
  const aheadMs = date.getTime() - Date.now();
  expect(aheadMs).toBeGreaterThan(DAY_MS - TOLERANCE_MS);
  expect(aheadMs).toBeLessThan(DAY_MS + TOLERANCE_MS);
}

describe('the test clock', () => {
  it('does not exist unless TEST_CLOCK_ENABLED is on', async () => {
    const res = await request(createApp({ testClockEnabled: false }))
      .get('/api/dev/clock')
      .set('x-dev-learner-id', demoLearner());

    expect(res.status).toBe(404);
  });

  it('refuses any learner who is not a demo learner, and writes nothing', async () => {
    const learnerId = randomUUID();

    const read = await request(createApp()).get('/api/dev/clock').set('x-dev-learner-id', learnerId);
    const move = await advance(learnerId, DAY_S);
    const reset = await request(createApp())
      .post('/api/dev/demo-learner/reset')
      .set('x-dev-learner-id', learnerId);

    expect([read.status, move.status, reset.status]).toEqual([403, 403, 403]);
    expect(await prisma.learnerClockOffset.count({ where: { learnerId } })).toBe(0);
  });

  it('only moves forward, and adds up', async () => {
    const learnerId = demoLearner();

    expect((await advance(learnerId, 0)).status).toBe(400);
    expect((await advance(learnerId, -HOUR_S)).status).toBe(400);
    expect((await advance(learnerId, 1.5)).status).toBe(400);

    expect((await advance(learnerId, HOUR_S)).body.offsetSeconds).toBe(HOUR_S);
    const res = await advance(learnerId, DAY_S);

    expect(res.status).toBe(200);
    expect(res.body.offsetSeconds).toBe(HOUR_S + DAY_S);

    const clock = await request(createApp()).get('/api/dev/clock').set('x-dev-learner-id', learnerId);
    const aheadMs = new Date(clock.body.now).getTime() - Date.now();
    expect(Math.abs(aheadMs - (HOUR_S + DAY_S) * 1000)).toBeLessThan(TOLERANCE_MS);
  });

  it("stamps a demo learner's answer with the advanced time, everywhere it is read", async () => {
    const learnerId = demoLearner();
    await advance(learnerId, DAY_S);

    expect((await answerCorrectly(learnerId)).status).toBe(200);

    const [review, state, litre] = await Promise.all([
      prisma.reviewEvent.findFirstOrThrow({ where: { learnerId } }),
      prisma.itemMemoryState.findFirstOrThrow({ where: { learnerId } }),
      prisma.litreEvent.findFirstOrThrow({ where: { learnerId } }),
    ]);

    // reviewedAt is the one Postgres used to stamp itself - the reason the
    // remediation day rule could never have been demonstrated before.
    expectAboutADayAhead(review.reviewedAt);
    expectAboutADayAhead(state.lastReviewedAt as Date);
    expectAboutADayAhead(litre.effectiveAt);
  });

  it('leaves everyone else on real time', async () => {
    const learnerId = randomUUID();

    expect((await answerCorrectly(learnerId)).status).toBe(200);

    const review = await prisma.reviewEvent.findFirstOrThrow({ where: { learnerId } });
    expect(Math.abs(review.reviewedAt.getTime() - Date.now())).toBeLessThan(TOLERANCE_MS);
  });

  it('reset deletes everything the demo learner wrote, and the offset with it', async () => {
    const learnerId = demoLearner();
    await advance(learnerId, DAY_S);
    await answerCorrectly(learnerId);

    const res = await request(createApp())
      .post('/api/dev/demo-learner/reset')
      .set('x-dev-learner-id', learnerId);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toMatchObject({ reviewEvents: 1, litreEvents: 1, clockOffsets: 1 });

    const remaining = await Promise.all([
      prisma.reviewEvent.count({ where: { learnerId } }),
      prisma.itemMemoryState.count({ where: { learnerId } }),
      prisma.litreEvent.count({ where: { learnerId } }),
      prisma.flightEvent.count({ where: { learnerId } }),
      prisma.flight.count({ where: { learnerId } }),
      prisma.learnerClockOffset.count({ where: { learnerId } }),
    ]);
    expect(remaining).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
