import { randomUUID } from 'node:crypto';
import { POINTS_FIRST_CORRECT } from '@ogwi/shared';
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

function submit(learnerId: string, body: object) {
  return request(createApp())
    .post('/api/scheduler/answers')
    .set('x-dev-learner-id', learnerId)
    .send(body);
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
