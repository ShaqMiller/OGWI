import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * The odds of passing as a published value (Doc 2 B2: "recomputed only at
 * publish points"), gated by the first-score unlock checklist - over HTTP,
 * the way the app and the demo drive it.
 */

const HOUR_S = 60 * 60;
const DAY_S = 24 * HOUR_S;

interface SeededItem {
  knowledgeItemId: string;
  renderingId: string;
  correctOptionIndex: number;
}

let items: Map<string, SeededItem>;

beforeAll(async () => {
  const renderings = await prisma.rendering.findMany({
    where: {
      role: 'BASE',
      knowledgeItem: { objective: { topic: { module: { qualification: { slug: 'demo-cert' } } } } },
    },
  });
  items = new Map(
    renderings.map((rendering) => [
      rendering.knowledgeItemId,
      {
        knowledgeItemId: rendering.knowledgeItemId,
        renderingId: rendering.id,
        correctOptionIndex: (rendering.content as { correctOptionIndex: number }).correctOptionIndex,
      },
    ]),
  );
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

async function sitExamCorrectly(learnerId: string) {
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
        selectedOptionIndex: items.get(question.knowledgeItemId)!.correctOptionIndex,
      });
  }

  const submit = await request(createApp())
    .post(`/api/exam/runs/${runId}/submit`)
    .set('x-dev-learner-id', learnerId);
  expect(submit.status).toBe(200);
}

async function readReadiness(learnerId: string) {
  const res = await request(createApp()).get('/api/readiness/demo-cert').set('x-dev-learner-id', learnerId);
  expect(res.status).toBe(200);
  return res.body;
}

async function endSession(learnerId: string) {
  const res = await request(createApp()).post('/api/publishing/demo-cert').set('x-dev-learner-id', learnerId);
  expect(res.status).toBe(200);
  return res.body;
}

function advanceClock(learnerId: string, seconds: number) {
  return request(createApp())
    .post('/api/dev/clock/advance')
    .set('x-dev-learner-id', learnerId)
    .send({ seconds });
}

const publicationCount = (learnerId: string) =>
  prisma.readinessPublication.count({ where: { learnerId } });

const doneKeys = (view: { checklist: { items: { key: string; done: boolean }[] } }) =>
  view.checklist.items.filter((item) => item.done).map((item) => item.key);

describe('the odds of passing, published', () => {
  it('shows only the unlock checklist before anything has happened', async () => {
    const view = await readReadiness(randomUUID());

    expect(view.published).toBeNull();
    expect(view.checklist.unlocked).toBe(false);
    expect(doneKeys(view)).toEqual([]);
  });

  it('publishes no score until the checklist is complete, then publishes one on exam submit', async () => {
    const learnerId = randomUUID();
    await answerCorrectly(learnerId, [...items.values()]);

    // A topic done and the course's only module touched - but no exam yet.
    const beforeExam = await endSession(learnerId);
    expect(beforeExam.readiness.unlocked).toBe(false);
    expect(beforeExam.readiness.oddsPercent).toBeNull();
    expect(doneKeys(await readReadiness(learnerId))).toEqual(['first_topic', 'modules']);

    // Submitting the exam is both the last checklist item and a publish point.
    await sitExamCorrectly(learnerId);
    const view = await readReadiness(learnerId);

    expect(view.checklist.unlocked).toBe(true);
    expect(view.published.unlocked).toBe(true);
    expect(view.published.oddsPercent === null ? view.published.withheld : true).toBe(true);
    expect(view.published.breakdown.calibrationRuns).toHaveLength(1);
  });

  it('holds still while the learner answers, and moves only at a publish point', async () => {
    const learnerId = randomUUID();
    const all = [...items.values()];
    await answerCorrectly(learnerId, all);
    await sitExamCorrectly(learnerId);
    const published = (await readReadiness(learnerId)).published;

    await answerCorrectly(learnerId, all);
    const midSession = (await readReadiness(learnerId)).published;
    expect(midSession).toEqual(published);

    await endSession(learnerId);
    const afterSession = (await readReadiness(learnerId)).published;
    expect(new Date(afterSession.publishedAt).getTime()).toBeGreaterThan(
      new Date(published.publishedAt).getTime(),
    );
  });

  it('rolls over once on the first read of a new day, never mid-activity', async () => {
    const learnerId = demoLearner();
    await answerCorrectly(learnerId, [...items.values()]);
    await endSession(learnerId);
    const afterSession = await publicationCount(learnerId);

    // A new day, but the learner is answering right now.
    await advanceClock(learnerId, DAY_S);
    await answerCorrectly(learnerId, [...items.values()].slice(0, 1));
    await readReadiness(learnerId);
    expect(await publicationCount(learnerId)).toBe(afterSession);

    // An hour idle later, the first read publishes, and the second doesn't.
    await advanceClock(learnerId, HOUR_S);
    await readReadiness(learnerId);
    expect(await publicationCount(learnerId)).toBe(afterSession + 1);
    await readReadiness(learnerId);
    expect(await publicationCount(learnerId)).toBe(afterSession + 1);
  });

  it('keeps every publication, so the odds have a history', async () => {
    const learnerId = randomUUID();
    await answerCorrectly(learnerId, [...items.values()]);

    await endSession(learnerId);
    await endSession(learnerId);

    expect(await publicationCount(learnerId)).toBe(2);
  });
});
