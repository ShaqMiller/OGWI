import { randomUUID } from 'node:crypto';
import { POINTS_FIRST_CORRECT } from '@ogwi/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import * as examService from '../exam.service.js';

/**
 * Service-level checks for things the HTTP layer would obscure - chiefly that
 * a paper pumps the flight ONCE rather than once per question. Pumping
 * replays the whole flight history each time, so per-item pumping is
 * quadratic in an active learner's history.
 */

let keyByItem: Map<string, number>;

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

  keyByItem = new Map(
    renderings.map((rendering) => [
      rendering.knowledgeItemId,
      (rendering.content as { correctOptionIndex: number }).correctOptionIndex,
    ]),
  );
});

/** Starts a run and answers `count` questions correctly. */
async function sit(learnerId: string, count: number): Promise<string> {
  const { runId } = await examService.startRun(learnerId, 'demo-cert');
  const paper = await examService.getPaper(runId, learnerId);

  for (const question of paper.questions.slice(0, count)) {
    await examService.saveAnswer(
      runId,
      learnerId,
      question.knowledgeItemId,
      keyByItem.get(question.knowledgeItemId) as number,
    );
  }

  return runId;
}

describe('submitRun', () => {
  it('pumps the flight once for the whole paper, not once per question', async () => {
    const learnerId = randomUUID();
    const runId = await sit(learnerId, 5);

    await examService.submitRun(runId, learnerId);

    const pumps = await prisma.flightEvent.findMany({
      where: { learnerId, eventType: 'PUMP' },
    });

    expect(pumps).toHaveLength(1);
    // ...carrying the paper's whole earnings, so nothing is lost by batching.
    expect((pumps[0]!.payload as { amount: number }).amount).toBe(5 * POINTS_FIRST_CORRECT);
  });

  it('still writes one litre event per answered question', async () => {
    // Litres are source-itemised (Doc 2 B8): only the pump aggregates.
    const learnerId = randomUUID();
    const runId = await sit(learnerId, 5);

    await examService.submitRun(runId, learnerId);

    expect(await prisma.litreEvent.count({ where: { learnerId } })).toBe(5);
  });

  it('does not re-grade an item that was already claimed', async () => {
    const learnerId = randomUUID();
    const runId = await sit(learnerId, 4);

    await examService.submitRun(runId, learnerId);
    const afterFirst = await prisma.reviewEvent.count({ where: { learnerId } });

    // A retry of a submit that crashed part-way must resume, not restart.
    await examService.submitRun(runId, learnerId);

    expect(await prisma.reviewEvent.count({ where: { learnerId } })).toBe(afterFirst);
    expect(afterFirst).toBe(4);
  });

  it('marks every item, leaving unanswered ones ungraded rather than wrong', async () => {
    const learnerId = randomUUID();
    const runId = await sit(learnerId, 3);

    const results = await examService.submitRun(runId, learnerId);
    const unanswered = results.questions.filter((q) => q.selectedOptionIndex === null);

    expect(unanswered.length).toBeGreaterThan(0);
    // `correct: null` is "never attempted", distinct from `false` = got it wrong.
    expect(unanswered.every((q) => q.correct === null)).toBe(true);
    expect(results.correctCount).toBe(3);
  });
});
