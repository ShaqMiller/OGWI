import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * Mastery publish points (Doc 2 C4). Displayed mastery changes only at session
 * end, practice-run end, exam submit or the daily rollover - never
 * mid-activity. Driven over HTTP with the test clock, the way the demo does it.
 */

const HOUR_S = 60 * 60;
const DAY_S = 24 * HOUR_S;

interface SeededItem {
  knowledgeItemId: string;
  renderingId: string;
  correctOptionIndex: number;
}

type Mastery = { moduleId: string; liveScore: number; displayedScore: number; state: string }[];

let items: SeededItem[];

beforeAll(async () => {
  const renderings = await prisma.rendering.findMany({
    where: {
      role: 'BASE',
      knowledgeItem: { objective: { topic: { module: { qualification: { slug: 'demo-cert' } } } } },
    },
    orderBy: { knowledgeItemId: 'asc' },
  });
  if (renderings.length < 2) {
    throw new Error('Seed data missing - run `pnpm --filter @ogwi/api run db:test:setup` first');
  }

  items = renderings.map((rendering) => ({
    knowledgeItemId: rendering.knowledgeItemId,
    renderingId: rendering.id,
    correctOptionIndex: (rendering.content as { correctOptionIndex: number }).correctOptionIndex,
  }));
});

const demoLearner = () => `demo-test-${randomUUID()}`;

async function answerCorrectly(learnerId: string, toAnswer: SeededItem[]) {
  for (const item of toAnswer) {
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

async function readMastery(learnerId: string): Promise<Mastery> {
  const res = await request(createApp()).get('/api/mastery/demo-cert').set('x-dev-learner-id', learnerId);
  expect(res.status).toBe(200);
  return res.body.modules;
}

async function publish(learnerId: string): Promise<Mastery> {
  const res = await request(createApp())
    .post('/api/publishing/demo-cert')
    .set('x-dev-learner-id', learnerId);
  expect(res.status).toBe(200);
  return res.body.mastery.modules;
}

function advanceClock(learnerId: string, seconds: number) {
  return request(createApp())
    .post('/api/dev/clock/advance')
    .set('x-dev-learner-id', learnerId)
    .send({ seconds });
}

const publishedRows = (learnerId: string) =>
  prisma.publishedMastery.findMany({ where: { learnerId }, orderBy: { moduleId: 'asc' } });

describe('mastery publish points', () => {
  it('answering moves live mastery, but not what is displayed', async () => {
    const learnerId = demoLearner();
    await answerCorrectly(learnerId, items);

    const mastery = await readMastery(learnerId);

    expect(mastery.some((module) => module.liveScore > 0)).toBe(true);
    expect(mastery.every((module) => module.displayedScore === 0)).toBe(true);
    // The read wrote nothing.
    expect(await publishedRows(learnerId)).toEqual([]);
  });

  it('ending a session publishes, and a gain lands in full', async () => {
    const learnerId = demoLearner();
    await answerCorrectly(learnerId, items);

    const published = await publish(learnerId);
    for (const module of published) {
      expect(module.displayedScore).toBeCloseTo(module.liveScore, 10);
    }

    const rowsAfterPublish = await publishedRows(learnerId);
    const read = await readMastery(learnerId);
    expect(read.map((module) => module.displayedScore)).toEqual(
      published.map((module) => module.displayedScore),
    );
    expect(await publishedRows(learnerId)).toEqual(rowsAfterPublish);
  });

  it('a gain made after a publish waits for the next publish point', async () => {
    const learnerId = demoLearner();
    const half = Math.ceil(items.length / 2);
    await answerCorrectly(learnerId, items.slice(0, half));
    const first = await publish(learnerId);

    await answerCorrectly(learnerId, items.slice(half));
    const midSession = await readMastery(learnerId);

    expect(midSession.map((module) => module.displayedScore)).toEqual(
      first.map((module) => module.displayedScore),
    );
    expect(midSession.some((module) => module.liveScore > module.displayedScore + 1e-9)).toBe(true);

    const second = await publish(learnerId);
    for (const module of second) {
      expect(module.displayedScore).toBeCloseTo(module.liveScore, 10);
    }
  });

  it('a decline eases toward live over a 7-day half-life instead of dropping', async () => {
    const learnerId = demoLearner();
    await answerCorrectly(learnerId, items);
    const before = await publish(learnerId);

    // Two half-lives of forgetting, with nothing read in between.
    await advanceClock(learnerId, 14 * DAY_S);
    const after = await publish(learnerId);

    const declined = after.filter((module, index) => module.liveScore < before[index]!.displayedScore - 1e-6);
    expect(declined.length).toBeGreaterThan(0);

    for (const module of declined) {
      const previous = before.find((candidate) => candidate.moduleId === module.moduleId)!.displayedScore;
      // Two half-lives close three quarters of the gap - no more.
      expect(module.displayedScore).toBeCloseTo(previous + 0.75 * (module.liveScore - previous), 4);
      expect(module.displayedScore).toBeGreaterThan(module.liveScore);
    }
  });

  it('the daily rollover publishes on the first read of a new day, once', async () => {
    const learnerId = demoLearner();
    await answerCorrectly(learnerId, items);

    await advanceClock(learnerId, DAY_S);
    const rolledOver = await readMastery(learnerId);

    for (const module of rolledOver) {
      expect(module.displayedScore).toBeCloseTo(module.liveScore, 10);
    }

    const rowsAfterRollover = await publishedRows(learnerId);
    expect(rowsAfterRollover.length).toBeGreaterThan(0);
    await readMastery(learnerId);
    expect(await publishedRows(learnerId)).toEqual(rowsAfterRollover);
  });

  it('the daily rollover never lands mid-activity', async () => {
    const learnerId = demoLearner();
    await answerCorrectly(learnerId, items.slice(0, 1));
    await publish(learnerId);
    const rowsBefore = await publishedRows(learnerId);

    // A new day, but the learner is answering right now.
    await advanceClock(learnerId, DAY_S);
    await answerCorrectly(learnerId, items.slice(1));
    await readMastery(learnerId);
    expect(await publishedRows(learnerId)).toEqual(rowsBefore);

    // An hour idle later, the first read rolls over.
    await advanceClock(learnerId, HOUR_S);
    await readMastery(learnerId);
    const rowsAfter = await publishedRows(learnerId);
    expect(rowsAfter.length).toBeGreaterThan(0);
    expect(rowsAfter[0]!.lastPublishedAt.getTime()).toBeGreaterThan(rowsBefore[0]!.lastPublishedAt.getTime());
  });

  it('submitting an exam is a publish point', async () => {
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
          selectedOptionIndex: byItem.get(question.knowledgeItemId)!.correctOptionIndex,
        });
    }
    expect(await publishedRows(learnerId)).toEqual([]);

    const submit = await request(createApp())
      .post(`/api/exam/runs/${runId}/submit`)
      .set('x-dev-learner-id', learnerId);
    expect(submit.status).toBe(200);

    expect((await publishedRows(learnerId)).length).toBeGreaterThan(0);
    const mastery = await readMastery(learnerId);
    expect(mastery.some((module) => module.displayedScore > 0)).toBe(true);
  });
});
