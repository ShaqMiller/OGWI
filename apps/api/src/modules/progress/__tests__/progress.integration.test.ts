import { randomUUID } from 'node:crypto';
import type { WeeklyActivity } from '@ogwi/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * Doc 2 A10 part 2, "This week so far", over HTTP.
 */

interface SeededItem {
  knowledgeItemId: string;
  renderingId: string;
  correctOptionIndex: number;
}

let items: SeededItem[];
let topicCount: number;

beforeAll(async () => {
  const renderings = await prisma.rendering.findMany({
    where: {
      role: 'BASE',
      knowledgeItem: { objective: { topic: { module: { qualification: { slug: 'demo-cert' } } } } },
    },
  });
  items = renderings.map((rendering) => ({
    knowledgeItemId: rendering.knowledgeItemId,
    renderingId: rendering.id,
    correctOptionIndex: (rendering.content as { correctOptionIndex: number }).correctOptionIndex,
  }));

  topicCount = await prisma.topic.count({
    where: { module: { qualification: { slug: 'demo-cert' } } },
  });
});

async function answerEverythingCorrectly(learnerId: string) {
  for (const item of items) {
    const res = await request(createApp())
      .post('/api/scheduler/answers')
      .set('x-dev-learner-id', learnerId)
      .send({
        attemptId: randomUUID(),
        knowledgeItemId: item.knowledgeItemId,
        renderingId: item.renderingId,
        answer: { kind: 'option_index', selectedOptionIndex: item.correctOptionIndex },
      });
    expect(res.status).toBe(200);
  }
}

async function readWeek(learnerId: string, weeksAgo = 0): Promise<WeeklyActivity> {
  const res = await request(createApp())
    .get('/api/progress/weekly')
    .query({ qualificationSlug: 'demo-cert', weeksAgo })
    .set('x-dev-learner-id', learnerId);

  expect(res.status).toBe(200);
  return res.body;
}

describe('GET /api/progress/weekly', () => {
  it('is seven empty days for a learner who has done nothing', async () => {
    const week = await readWeek(randomUUID());

    expect(week.isCurrentWeek).toBe(true);
    expect(week.days).toHaveLength(7);
    expect(week.days.every((day) => day.litres === 0)).toBe(true);
    expect(week.totals).toEqual({ litres: 0, answers: 0, sessions: 0, topicsCompleted: 0 });
  });

  it("counts today's points, questions, sessions and finished topics", async () => {
    const learnerId = randomUUID();
    await answerEverythingCorrectly(learnerId);
    await request(createApp()).post('/api/publishing/demo-cert').set('x-dev-learner-id', learnerId);

    const week = await readWeek(learnerId);
    const today = new Date().toISOString().slice(0, 10);
    const earned = week.days.filter((day) => day.litres > 0);

    // Everything happened in one sitting, so exactly one day carries it.
    expect(earned).toHaveLength(1);
    expect(earned[0]!.date).toBe(today);
    expect(week.totals.litres).toBe(earned[0]!.litres);
    expect(week.totals.answers).toBe(items.length);
    // Ending the session is the learner's own publish point; the rollover isn't.
    expect(week.totals.sessions).toBe(1);
    // Answering every item finishes every topic in the course.
    expect(week.totals.topicsCompleted).toBe(topicCount);
  });

  it('skims back to earlier weeks, which are empty', async () => {
    const learnerId = randomUUID();
    await answerEverythingCorrectly(learnerId);

    const lastWeek = await readWeek(learnerId, 1);

    expect(lastWeek.isCurrentWeek).toBe(false);
    expect(lastWeek.weekStart < (await readWeek(learnerId)).weekStart).toBe(true);
    expect(lastWeek.totals).toEqual({ litres: 0, answers: 0, sessions: 0, topicsCompleted: 0 });
  });
});
