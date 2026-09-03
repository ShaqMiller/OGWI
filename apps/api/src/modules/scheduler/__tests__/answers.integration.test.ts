import { randomUUID } from 'node:crypto';
import { POINTS_FIRST_CORRECT, POINTS_NOT_DUE_CORRECT } from '@ogwi/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * POST /api/scheduler/answers - server-side answer checking.
 *
 * Replaced POST /api/scheduler/reviews, which accepted a client-computed
 * grade and so let any caller forge mastery, litres, altitude and pass odds
 * by posting `grade: "good"`.
 */

interface SeededItem {
  knowledgeItemId: string;
  renderingId: string;
  correctOptionIndex: number;
  optionCount: number;
}

let items: SeededItem[];

beforeAll(async () => {
  const qualification = await prisma.qualification.findUniqueOrThrow({
    where: { slug: 'demo-cert' },
  });

  const renderings = await prisma.rendering.findMany({
    where: {
      role: 'BASE',
      knowledgeItem: { objective: { topic: { module: { qualificationId: qualification.id } } } },
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

const answer = (index: number) => ({ kind: 'option_index' as const, selectedOptionIndex: index });

/** Defaults a fresh attemptId; pass one explicitly to simulate a retry. */
function submit(learnerId: string, body: Record<string, unknown>) {
  return request(createApp())
    .post('/api/scheduler/answers')
    .set('x-dev-learner-id', learnerId)
    .send({ attemptId: randomUUID(), ...body });
}

describe('POST /api/scheduler/answers', () => {
  it('marks a correct answer, grades it Good and records the rendering', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;

    const res = await submit(learnerId, {
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: answer(item.correctOptionIndex),
    });

    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);
    expect(res.body.grade).toBe('good');
    expect(res.body.correctOptionIndex).toBe(item.correctOptionIndex);

    const events = await prisma.reviewEvent.findMany({ where: { learnerId } });
    expect(events).toHaveLength(1);
    expect(events[0]!.grade).toBe('GOOD');
    // Non-null proves the rendering plumbing is actually live - it was
    // always null while the client did its own grading.
    expect(events[0]!.renderingId).toBe(item.renderingId);
  });

  it('marks a wrong answer, grades it Again and still reveals the key', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;
    const wrong = (item.correctOptionIndex + 1) % item.optionCount;

    const res = await submit(learnerId, {
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: answer(wrong),
    });

    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(false);
    expect(res.body.grade).toBe('again');
    expect(res.body.correctOptionIndex).toBe(item.correctOptionIndex);

    const events = await prisma.reviewEvent.findMany({ where: { learnerId } });
    expect(events[0]!.grade).toBe('AGAIN');
  });

  it('awards points for a first correct answer', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;

    await submit(learnerId, {
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: answer(item.correctOptionIndex),
    });

    const litreEvents = await prisma.litreEvent.findMany({ where: { learnerId } });
    const total = litreEvents.reduce((sum, event) => sum + event.amount, 0);
    expect(total).toBe(POINTS_FIRST_CORRECT);
  });

  it('rejects a rendering belonging to a different item, writing nothing', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;
    const otherItem = items.find((candidate) => candidate.renderingId !== item.renderingId)!;

    const res = await submit(learnerId, {
      knowledgeItemId: item.knowledgeItemId,
      renderingId: otherItem.renderingId,
      answer: answer(0),
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    // The check has to happen before the first write: gradeReview spans four
    // modules with no transaction, so a late rejection would leave a
    // half-recorded review behind.
    expect(await prisma.reviewEvent.count({ where: { learnerId } })).toBe(0);
    expect(await prisma.litreEvent.count({ where: { learnerId } })).toBe(0);
    expect(await prisma.itemMemoryState.count({ where: { learnerId } })).toBe(0);
  });

  it('rejects an option index that does not exist, writing nothing', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;

    const res = await submit(learnerId, {
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: answer(999),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.reviewEvent.count({ where: { learnerId } })).toBe(0);
  });

  it('requires a learner', async () => {
    const item = items[0]!;

    const res = await request(createApp())
      .post('/api/scheduler/answers')
      .send({
        knowledgeItemId: item.knowledgeItemId,
        renderingId: item.renderingId,
        answer: answer(0),
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/scheduler/reviews', () => {
  it('no longer exists, so a client-supplied grade cannot be posted', async () => {
    const item = items[0]!;

    const res = await request(createApp())
      .post('/api/scheduler/reviews')
      .set('x-dev-learner-id', randomUUID())
      .send({ knowledgeItemId: item.knowledgeItemId, grade: 'good' });

    expect(res.status).toBe(404);
  });
});

describe('attempt idempotency', () => {
  const counts = async (learnerId: string) => ({
    reviews: await prisma.reviewEvent.count({ where: { learnerId } }),
    litres: await prisma.litreEvent.count({ where: { learnerId } }),
    pumps: await prisma.flightEvent.count({ where: { learnerId, eventType: 'PUMP' } }),
  });

  /**
   * The scope boundary. Doc 2 B8 makes re-grinding a not-due item pay 1L and
   * calls that "the only anti-farm mechanism; no access restrictions exist",
   * and Doc 4 forbids policing the learner. Idempotency must therefore key on
   * the ATTEMPT, never on the item - if this ever fails, someone has turned
   * retry protection into the cooldown the spec rules out.
   */
  it('treats a new attemptId on the same item as a fresh, priced learning act', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;
    const body = {
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: answer(item.correctOptionIndex),
    };

    await submit(learnerId, { ...body, attemptId: randomUUID() });
    await submit(learnerId, { ...body, attemptId: randomUUID() });

    expect((await counts(learnerId)).reviews).toBe(2);
    const litres = await prisma.litreEvent.findMany({ where: { learnerId } });
    expect(litres.reduce((sum, e) => sum + e.amount, 0)).toBe(
      POINTS_FIRST_CORRECT + POINTS_NOT_DUE_CORRECT,
    );
  });

  it('replays a retried attempt without writing anything new', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;
    const attemptId = randomUUID();
    const body = {
      attemptId,
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: answer(item.correctOptionIndex),
    };

    const first = await submit(learnerId, body);
    const afterFirst = await counts(learnerId);

    const retry = await submit(learnerId, body);

    expect(retry.status).toBe(200);
    expect(retry.body).toEqual(first.body);
    expect(await counts(learnerId)).toEqual(afterFirst);
    // The FSRS card must not have been advanced a second time either.
    const state = await prisma.itemMemoryState.findFirstOrThrow({ where: { learnerId } });
    expect(state.reps).toBe(1);
  });

  it('refuses an attemptId reused for a different answer', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;
    const attemptId = randomUUID();
    const base = {
      attemptId,
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
    };

    await submit(learnerId, { ...base, answer: answer(item.correctOptionIndex) });
    const res = await submit(learnerId, {
      ...base,
      answer: answer((item.correctOptionIndex + 1) % item.optionCount),
    });

    // Loud, not silent: quietly returning the first result would swallow the
    // second answer, which is indistinguishable from a cooldown.
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect((await counts(learnerId)).reviews).toBe(1);
  });

  it('writes one set of rows when two identical requests race', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;
    const body = {
      attemptId: randomUUID(),
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: answer(item.correctOptionIndex),
    };

    const [a, b] = await Promise.all([submit(learnerId, body), submit(learnerId, body)]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body).toEqual(b.body);
    expect(await counts(learnerId)).toEqual({ reviews: 1, litres: 1, pumps: 1 });
  });

  it('requires an attemptId', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;

    const res = await request(createApp())
      .post('/api/scheduler/answers')
      .set('x-dev-learner-id', learnerId)
      .send({
        knowledgeItemId: item.knowledgeItemId,
        renderingId: item.renderingId,
        answer: answer(0),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.reviewEvent.count({ where: { learnerId } })).toBe(0);
  });

  it('records a derived idempotency key, not a random one', async () => {
    const learnerId = randomUUID();
    const item = items[0]!;

    await submit(learnerId, {
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: answer(item.correctOptionIndex),
    });

    const litre = await prisma.litreEvent.findFirstOrThrow({ where: { learnerId } });
    const pump = await prisma.flightEvent.findFirstOrThrow({
      where: { learnerId, eventType: 'PUMP' },
    });

    expect(litre.idempotencyKey.startsWith(`review:${learnerId}:`)).toBe(true);
    expect(litre.idempotencyKey.endsWith(':litre')).toBe(true);
    expect(pump.idempotencyKey?.endsWith(':pump')).toBe(true);
  });
});
