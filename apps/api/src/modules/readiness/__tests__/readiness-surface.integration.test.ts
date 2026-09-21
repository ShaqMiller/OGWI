import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * The rest of Doc 2 B2's readiness surface, over HTTP: the next action, the
 * first-score reveal, and the forecast freezing after 14 quiet days. (The
 * celebration's rules are covered in publication-rules.util.test - 80% odds
 * isn't reachable on the eight-question demo course.)
 */

const DAY_S = 24 * 60 * 60;

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

async function answerEverythingCorrectly(learnerId: string, count = items.size) {
  for (const item of [...items.values()].slice(0, count)) {
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

async function sitMiniMock(learnerId: string) {
  const start = await request(createApp())
    .post('/api/exam/runs')
    .set('x-dev-learner-id', learnerId)
    .send({ qualificationSlug: 'demo-cert', kind: 'MINI_MOCK' });
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
  const submit = await request(createApp()).post(`/api/exam/runs/${runId}/submit`).set('x-dev-learner-id', learnerId);
  expect(submit.status).toBe(200);
}

async function endSession(learnerId: string) {
  const res = await request(createApp()).post('/api/publishing/demo-cert').set('x-dev-learner-id', learnerId);
  expect(res.status).toBe(200);
  return res.body.readiness;
}

function advanceClock(learnerId: string, seconds: number) {
  return request(createApp())
    .post('/api/dev/clock/advance')
    .set('x-dev-learner-id', learnerId)
    .send({ seconds });
}

describe('the next action', () => {
  type Candidate = { kind: string; line: string; bandSteps: number; score: number };

  it('offers a mini-mock when exam evidence is missing, valuing the band step it would buy', async () => {
    const learnerId = randomUUID();
    await answerEverythingCorrectly(learnerId);

    const published = await endSession(learnerId);
    const candidates = published.breakdown.nextActionCandidates as Candidate[];

    // Full coverage, no exam run: one mini-mock would lift early to fair.
    expect(candidates.find((candidate) => candidate.kind === 'mini_mock')).toMatchObject({
      bandSteps: 1,
      line: 'One mini-mock would firm this number up.',
    });
    // Mastery published first, at 100%, so no module drags below the pass
    // mark and there is no Biggest Opportunity to suggest.
    expect(candidates.some((candidate) => candidate.kind === 'biggest_opportunity')).toBe(false);

    // The winner is the highest-scoring candidate, as one plain line.
    const best = Math.max(...candidates.map((candidate) => candidate.score));
    expect(published.nextAction.score).toBeCloseTo(best, 10);
    expect(typeof published.nextAction.line).toBe('string');
  });

  it('points at the Biggest Opportunity while a module sits below the pass mark', async () => {
    const learnerId = randomUUID();
    await answerEverythingCorrectly(learnerId, 2);

    const published = await endSession(learnerId);
    const opportunity = (published.breakdown.nextActionCandidates as Candidate[]).find(
      (candidate) => candidate.kind === 'biggest_opportunity',
    );

    expect(opportunity?.line).toBe(
      "A session on Networking Basics would lift this most - it's 100% of the exam.",
    );
    expect(opportunity!.score).toBeGreaterThan(0);
  });

  it('suggests refreshing once questions fall due', async () => {
    const learnerId = demoLearner();
    await answerEverythingCorrectly(learnerId);
    await advanceClock(learnerId, 30 * DAY_S);

    const published = await endSession(learnerId);
    const refresh = published.breakdown.nextActionCandidates.find(
      (candidate: { kind: string }) => candidate.kind === 'refresh',
    );

    expect(refresh.line).toBe(`Refreshing the ${items.size} questions due for review would lift this most.`);
    expect(refresh.oddsDelta).toBeGreaterThan(0);
  });
});

describe('the first-score reveal', () => {
  it('marks only the first publication that carries a score', async () => {
    const learnerId = randomUUID();
    await answerEverythingCorrectly(learnerId);

    expect((await endSession(learnerId)).firstScore).toBe(false); // still locked
    await sitMiniMock(learnerId); // unlocks and publishes

    const revealed = await request(createApp()).get('/api/readiness/demo-cert').set('x-dev-learner-id', learnerId);
    expect(revealed.body.published.unlocked).toBe(true);
    expect(revealed.body.published.firstScore).toBe(true);

    expect((await endSession(learnerId)).firstScore).toBe(false);
  });
});

describe('the forecast', () => {
  it('freezes at its last value after 14 fully quiet days', async () => {
    const learnerId = demoLearner();
    await answerEverythingCorrectly(learnerId);
    const before = await endSession(learnerId);
    expect(before.forecast.frozen).toBe(false);

    await advanceClock(learnerId, 15 * DAY_S);
    const after = await endSession(learnerId);

    expect(after.forecast.frozen).toBe(true);
    expect(after.forecast.expectedFinishDate).toBe(before.forecast.expectedFinishDate);
  });

  it('picks back up once the learner answers again', async () => {
    const learnerId = demoLearner();
    await answerEverythingCorrectly(learnerId);
    await endSession(learnerId);
    await advanceClock(learnerId, 15 * DAY_S);
    await endSession(learnerId);

    await answerEverythingCorrectly(learnerId);
    expect((await endSession(learnerId)).forecast.frozen).toBe(false);
  });
});
