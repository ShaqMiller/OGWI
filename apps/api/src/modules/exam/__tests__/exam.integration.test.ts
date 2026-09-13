import { randomUUID } from 'node:crypto';
import {
  EXAM_SECONDS_PER_QUESTION,
  POINTS_FIRST_CORRECT,
  PREMIUM_EXAM_SIMULATION,
} from '@ogwi/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import * as economyService from '../../economy/economy.service.js';

/**
 * Exam runs end to end. The two assertions that matter most are the key-leak
 * check (invariant 10) and the idempotency of submit - the latter guards an
 * append-only log that cannot be repaired if it gets double-written.
 */

/** demo-cert holds 8 knowledge items, all MULTIPLE_CHOICE, in one module. */
const DEMO_CERT_ITEM_COUNT = 8;

let keyByItem: Map<string, number>;
let optionCountByItem: Map<string, number>;

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

  keyByItem = new Map();
  optionCountByItem = new Map();
  for (const rendering of renderings) {
    const content = rendering.content as { options: string[]; correctOptionIndex: number };
    keyByItem.set(rendering.knowledgeItemId, content.correctOptionIndex);
    optionCountByItem.set(rendering.knowledgeItemId, content.options.length);
  }
});

const asLearner = (learnerId: string) => ({ 'x-dev-learner-id': learnerId });

async function startRun(learnerId: string) {
  const res = await request(createApp())
    .post('/api/exam/runs')
    .set(asLearner(learnerId))
    .send({ qualificationSlug: 'demo-cert' });

  expect(res.status).toBe(201);
  return res.body as { runId: string; questionCount: number; allottedSeconds: number };
}

function getPaper(learnerId: string, runId: string) {
  return request(createApp()).get(`/api/exam/runs/${runId}`).set(asLearner(learnerId));
}

function saveAnswer(learnerId: string, runId: string, knowledgeItemId: string, index: number) {
  return request(createApp())
    .post(`/api/exam/runs/${runId}/answers`)
    .set(asLearner(learnerId))
    .send({ knowledgeItemId, selectedOptionIndex: index });
}

function submit(learnerId: string, runId: string) {
  return request(createApp()).post(`/api/exam/runs/${runId}/submit`).set(asLearner(learnerId));
}

describe('starting a run', () => {
  it('caps the paper at the available content and sizes the allotment to it', async () => {
    const run = await startRun(randomUUID());

    // The configured target is 30; demo-cert only has 8 eligible items.
    expect(run.questionCount).toBe(DEMO_CERT_ITEM_COUNT);
    expect(run.allottedSeconds).toBe(DEMO_CERT_ITEM_COUNT * EXAM_SECONDS_PER_QUESTION);
  });

  it('draws every item once, with no repeats', async () => {
    const learnerId = randomUUID();
    const run = await startRun(learnerId);
    const paper = await getPaper(learnerId, run.runId);

    const ids = paper.body.questions.map((q: { knowledgeItemId: string }) => q.knowledgeItemId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(paper.body.questions.map((q: { position: number }) => q.position)).toEqual(
      Array.from({ length: DEMO_CERT_ITEM_COUNT }, (_, i) => i),
    );
  });

  it('requires a learner', async () => {
    const res = await request(createApp())
      .post('/api/exam/runs')
      .send({ qualificationSlug: 'demo-cert' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('sitting a run', () => {
  it('serves questions with no answer key of any kind', async () => {
    const learnerId = randomUUID();
    const run = await startRun(learnerId);
    const paper = await getPaper(learnerId, run.runId);

    expect(paper.status).toBe(200);
    // An exact-shape assertion, not a search for `correctOptionIndex`: a
    // differently-named leak (isCorrect, answer, key...) must fail too.
    for (const question of paper.body.questions) {
      expect(Object.keys(question).sort()).toEqual(
        [
          'format',
          'knowledgeItemId',
          'options',
          'position',
          'prompt',
          'renderingId',
          'selectedOptionIndex',
        ].sort(),
      );
    }
  });

  it("hides another learner's run behind a 404, not a 403", async () => {
    const owner = randomUUID();
    const run = await startRun(owner);

    const res = await getPaper(randomUUID(), run.runId);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('saves a selection without revealing anything, and reflects it on reload', async () => {
    const learnerId = randomUUID();
    const run = await startRun(learnerId);
    const paper = await getPaper(learnerId, run.runId);
    const first = paper.body.questions[0];

    const saved = await saveAnswer(learnerId, run.runId, first.knowledgeItemId, 1);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ saved: true });

    const reloaded = await getPaper(learnerId, run.runId);
    expect(reloaded.body.questions[0].selectedOptionIndex).toBe(1);
  });

  it('lets an answer be changed, keeping one row', async () => {
    const learnerId = randomUUID();
    const run = await startRun(learnerId);
    const paper = await getPaper(learnerId, run.runId);
    const first = paper.body.questions[0];

    await saveAnswer(learnerId, run.runId, first.knowledgeItemId, 0);
    await saveAnswer(learnerId, run.runId, first.knowledgeItemId, 2);

    const reloaded = await getPaper(learnerId, run.runId);
    expect(reloaded.body.questions[0].selectedOptionIndex).toBe(2);
    expect(reloaded.body.questions).toHaveLength(DEMO_CERT_ITEM_COUNT);
  });

  it('rejects an option that does not exist, saving nothing', async () => {
    const learnerId = randomUUID();
    const run = await startRun(learnerId);
    const paper = await getPaper(learnerId, run.runId);
    const first = paper.body.questions[0];

    const res = await saveAnswer(learnerId, run.runId, first.knowledgeItemId, 999);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    const reloaded = await getPaper(learnerId, run.runId);
    expect(reloaded.body.questions[0].selectedOptionIndex).toBeNull();
  });
});

describe('submitting a run', () => {
  /** Answers `correctCount` questions right and `wrongCount` wrong, leaving the rest blank. */
  async function sitPartially(learnerId: string, correctCount: number, wrongCount: number) {
    const run = await startRun(learnerId);
    const paper = await getPaper(learnerId, run.runId);
    const questions = paper.body.questions as { knowledgeItemId: string }[];

    for (let i = 0; i < correctCount; i += 1) {
      const item = questions[i] as { knowledgeItemId: string };
      await saveAnswer(learnerId, run.runId, item.knowledgeItemId, keyByItem.get(item.knowledgeItemId) as number);
    }

    for (let i = correctCount; i < correctCount + wrongCount; i += 1) {
      const item = questions[i] as { knowledgeItemId: string };
      const key = keyByItem.get(item.knowledgeItemId) as number;
      const options = optionCountByItem.get(item.knowledgeItemId) as number;
      await saveAnswer(learnerId, run.runId, item.knowledgeItemId, (key + 1) % options);
    }

    return run;
  }

  it('scores blanks as wrong but writes review events only for answered questions', async () => {
    const learnerId = randomUUID();
    const run = await sitPartially(learnerId, 4, 1); // 3 left blank

    const res = await submit(learnerId, run.runId);

    expect(res.status).toBe(200);
    expect(res.body.correctCount).toBe(4);
    expect(res.body.scoredCount).toBe(DEMO_CERT_ITEM_COUNT);
    expect(res.body.answeredCount).toBe(5);
    expect(res.body.scorePercent).toBe(50);
    expect(res.body.passMarkPercent).toBe(70);
    expect(res.body.passed).toBe(false);

    // The load-bearing one: an unanswered question is not a memory failure,
    // so it must not write an Again into the append-only log.
    const events = await prisma.reviewEvent.findMany({ where: { learnerId } });
    expect(events).toHaveLength(5);
    expect(events.filter((e) => e.grade === 'GOOD')).toHaveLength(4);
    expect(events.filter((e) => e.grade === 'AGAIN')).toHaveLength(1);
    // Every event records the rendering that was actually served.
    expect(events.every((e) => e.renderingId !== null)).toBe(true);
  });

  it('passes a run that clears the pass mark', async () => {
    const learnerId = randomUUID();
    const run = await sitPartially(learnerId, DEMO_CERT_ITEM_COUNT, 0);

    const res = await submit(learnerId, run.runId);

    expect(res.body.correctCount).toBe(DEMO_CERT_ITEM_COUNT);
    expect(res.body.scorePercent).toBe(100);
    expect(res.body.passed).toBe(true);
  });

  it('is idempotent - a second submit writes nothing and returns the same result', async () => {
    const learnerId = randomUUID();
    const run = await sitPartially(learnerId, 3, 2);

    const first = await submit(learnerId, run.runId);
    const counts = async () => ({
      reviews: await prisma.reviewEvent.count({ where: { learnerId } }),
      litres: await prisma.litreEvent.count({ where: { learnerId } }),
      pumps: await prisma.flightEvent.count({ where: { learnerId, eventType: 'PUMP' } }),
    });
    const afterFirst = await counts();

    const second = await submit(learnerId, run.runId);

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await counts()).toEqual(afterFirst);
  });

  it('survives two concurrent submits without double-writing', async () => {
    const learnerId = randomUUID();
    const run = await sitPartially(learnerId, 3, 1);

    const [a, b] = await Promise.all([submit(learnerId, run.runId), submit(learnerId, run.runId)]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await prisma.reviewEvent.count({ where: { learnerId } })).toBe(4);
  });

  it('pays the completion premium on a finished paper', async () => {
    const learnerId = randomUUID();
    const run = await sitPartially(learnerId, DEMO_CERT_ITEM_COUNT, 0);

    await submit(learnerId, run.runId);

    const litres = await prisma.litreEvent.findMany({ where: { learnerId } });
    const total = litres.reduce((sum, e) => sum + e.amount, 0);

    // Doc 2 B8: the premium is what makes a mock the largest single payment in
    // the product - per-question litres alone would be a fraction of it.
    expect(total).toBe(DEMO_CERT_ITEM_COUNT * POINTS_FIRST_CORRECT + PREMIUM_EXAM_SIMULATION);

    const premium = litres.find((e) => e.source === 'ASSESSMENT');
    expect(premium?.amount).toBe(PREMIUM_EXAM_SIMULATION);
    // Paid for the RUN, not for any one question.
    expect(premium?.knowledgeItemId).toBeNull();
  });

  it('counts the premium in the points balance and the Recent list', async () => {
    const learnerId = randomUUID();
    const demoCert = await prisma.qualification.findUniqueOrThrow({ where: { slug: 'demo-cert' } });
    const otherQualification = await prisma.qualification.findUniqueOrThrow({
      where: { slug: 'demo-pm-basics' },
    });
    const run = await sitPartially(learnerId, DEMO_CERT_ITEM_COUNT, 0);

    await submit(learnerId, run.runId);

    // Through the queries the app actually reads, not a raw sum of litre rows.
    // The premium tests above summed rows directly - which is how a balance
    // that silently dropped every premium shipped unnoticed.
    const balance = await economyService.getBalance(learnerId, demoCert.id);
    expect(balance.totalPoints).toBe(DEMO_CERT_ITEM_COUNT * POINTS_FIRST_CORRECT + PREMIUM_EXAM_SIMULATION);

    const recent = await economyService.getRecentEvents(learnerId, demoCert.id, 20);
    expect(recent.find((event) => event.source === 'ASSESSMENT')).toMatchObject({
      amount: PREMIUM_EXAM_SIMULATION,
      knowledgeItemId: null,
    });

    // ...and scoped to its own qualification, never leaking into another's.
    expect((await economyService.getBalance(learnerId, otherQualification.id)).totalPoints).toBe(0);
  });

  it('withholds the premium when too little of the paper was answered', async () => {
    const learnerId = randomUUID();
    // 5 of 8 is 62.5%, under the 70% gate.
    const run = await sitPartially(learnerId, 5, 0);

    await submit(learnerId, run.runId);

    const litres = await prisma.litreEvent.findMany({ where: { learnerId } });
    // The answered questions still pay; only the completion bonus is withheld.
    expect(litres.reduce((sum, e) => sum + e.amount, 0)).toBe(5 * POINTS_FIRST_CORRECT);
    expect(litres.some((e) => e.source === 'ASSESSMENT')).toBe(false);
  });

  it('pays the premium once however many times the run is submitted', async () => {
    const learnerId = randomUUID();
    const run = await sitPartially(learnerId, DEMO_CERT_ITEM_COUNT, 0);

    await submit(learnerId, run.runId);
    await submit(learnerId, run.runId);
    await submit(learnerId, run.runId);

    const premiums = await prisma.litreEvent.findMany({
      where: { learnerId, source: 'ASSESSMENT' },
    });
    expect(premiums).toHaveLength(1);
  });

  it('records derived idempotency keys, not random ones', async () => {
    const learnerId = randomUUID();
    const run = await sitPartially(learnerId, 3, 0);
    await submit(learnerId, run.runId);

    const litres = await prisma.litreEvent.findMany({ where: { learnerId } });
    const pumps = await prisma.flightEvent.findMany({
      where: { learnerId, eventType: 'PUMP' },
    });

    // schema.prisma promises "idempotencyKey is unique -> pumps are
    // idempotent". These assertions are what make that claim true rather than
    // vacuous - a randomUUID() satisfies the constraint on every write.
    expect(litres.every((e) => e.idempotencyKey.startsWith('exam-item:'))).toBe(true);
    expect(litres.every((e) => e.idempotencyKey.endsWith(':litre'))).toBe(true);
    expect(pumps).toHaveLength(1);
    expect(pumps[0]!.idempotencyKey?.startsWith('exam-item:')).toBe(true);
  });

  it('refuses to save an answer once submitted', async () => {
    const learnerId = randomUUID();
    const run = await sitPartially(learnerId, 1, 0);
    const paper = await getPaper(learnerId, run.runId);
    await submit(learnerId, run.runId);

    const res = await saveAnswer(
      learnerId,
      run.runId,
      paper.body.questions[1].knowledgeItemId,
      0,
    );

    expect(res.status).toBe(400);
  });
});

describe('results', () => {
  it('withholds results until the run is submitted, then reveals the key', async () => {
    const learnerId = randomUUID();
    const run = await startRun(learnerId);
    const results = () =>
      request(createApp()).get(`/api/exam/runs/${run.runId}/results`).set(asLearner(learnerId));

    const early = await results();
    expect(early.status).toBe(400);

    await submit(learnerId, run.runId);
    const after = await results();

    expect(after.status).toBe(200);
    expect(after.body.questions).toHaveLength(DEMO_CERT_ITEM_COUNT);
    for (const question of after.body.questions) {
      expect(typeof question.correctOptionIndex).toBe('number');
      expect(question.topicName).toBeTruthy();
      expect(question.moduleName).toBeTruthy();
    }
    // Nothing resembling an attempt count or history - invariant 12.
    expect(Object.keys(after.body)).not.toContain('attemptNumber');
    expect(Object.keys(after.body)).not.toContain('previousScore');
  });
});
