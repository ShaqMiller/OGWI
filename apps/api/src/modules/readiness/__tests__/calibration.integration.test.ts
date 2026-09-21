import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import * as readinessService from '../readiness.service.js';

/**
 * Exam-condition calibration end to end: a submitted exam run records the
 * projection it is judged against, and the odds apply the resulting ratio.
 */

interface SeededItem {
  knowledgeItemId: string;
  renderingId: string;
  correctOptionIndex: number;
  optionCount: number;
}

let qualificationId: string;
let passMark: number;
let items: Map<string, SeededItem>;

beforeAll(async () => {
  const qualification = await prisma.qualification.findUniqueOrThrow({ where: { slug: 'demo-cert' } });
  qualificationId = qualification.id;
  passMark = Number(qualification.passMark);

  const renderings = await prisma.rendering.findMany({
    where: { role: 'BASE', knowledgeItem: { objective: { topic: { module: { qualificationId } } } } },
  });
  items = new Map(
    renderings.map((rendering) => {
      const content = rendering.content as { options: string[]; correctOptionIndex: number };
      return [
        rendering.knowledgeItemId,
        {
          knowledgeItemId: rendering.knowledgeItemId,
          renderingId: rendering.id,
          correctOptionIndex: content.correctOptionIndex,
          optionCount: content.options.length,
        },
      ];
    }),
  );
});

async function practiseEverythingCorrectly(learnerId: string) {
  for (const item of items.values()) {
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

/** Sits a paper, answering the first `correctCount` questions right and the rest wrong. */
async function sitExam(learnerId: string, correctCount: number) {
  const start = await request(createApp())
    .post('/api/exam/runs')
    .set('x-dev-learner-id', learnerId)
    .send({ qualificationSlug: 'demo-cert' });
  const { runId } = start.body as { runId: string };

  const paper = await request(createApp()).get(`/api/exam/runs/${runId}`).set('x-dev-learner-id', learnerId);
  const questions = paper.body.questions as { knowledgeItemId: string }[];
  for (const [index, question] of questions.entries()) {
    const item = items.get(question.knowledgeItemId)!;
    await request(createApp())
      .post(`/api/exam/runs/${runId}/answers`)
      .set('x-dev-learner-id', learnerId)
      .send({
        knowledgeItemId: item.knowledgeItemId,
        selectedOptionIndex:
          index < correctCount ? item.correctOptionIndex : (item.correctOptionIndex + 1) % item.optionCount,
      });
  }

  const submit = await request(createApp())
    .post(`/api/exam/runs/${runId}/submit`)
    .set('x-dev-learner-id', learnerId);
  expect(submit.status).toBe(200);

  return { runId, questionCount: questions.length };
}

describe('exam-condition calibration', () => {
  it('stores the projection a run is judged against, taken before its own answers are graded', async () => {
    const learnerId = randomUUID();
    await practiseEverythingCorrectly(learnerId);
    const projectionBefore = await readinessService.computeProjectedScore(learnerId, qualificationId);

    // Answering every question wrong would drag the projection down if the
    // paper were graded first - the stored value must not see that.
    const { runId } = await sitExam(learnerId, 0);

    const run = await prisma.examRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.projectedScore).not.toBeNull();
    expect(run.projectedScore as number).toBeCloseTo(projectionBefore, 2);
    expect(await readinessService.computeProjectedScore(learnerId, qualificationId)).toBeLessThan(
      projectionBefore,
    );
  });

  it('applies achieved / projected to the odds, clamped', async () => {
    const learnerId = randomUUID();
    await practiseEverythingCorrectly(learnerId);
    const { questionCount } = await sitExam(learnerId, Math.floor(items.size / 2));

    const readiness = await readinessService.computeReadiness(learnerId, qualificationId, passMark);
    const { breakdown } = readiness;
    const [run] = breakdown.calibrationRuns;

    expect(breakdown.calibrationRuns).toHaveLength(1);
    expect(run!.achievedScore).toBeCloseTo(Math.floor(items.size / 2) / questionCount, 10);
    expect(run!.ratio).toBeCloseTo(run!.achievedScore / run!.projectedScore, 10);
    // Half a paper right against a strong projection is well below 0.7 - the floor applies.
    expect(breakdown.meanRatio as number).toBeLessThan(0.7);
    expect(breakdown.calibrationRatio).toBe(0.7);
    expect(breakdown.calibratedScore).toBeCloseTo(breakdown.projectedScore * 0.7, 10);
  });

  it('leaves the projection alone when there are no runs', async () => {
    const learnerId = randomUUID();
    await practiseEverythingCorrectly(learnerId);

    const { breakdown } = await readinessService.computeReadiness(learnerId, qualificationId, passMark);

    expect(breakdown.calibrationRatio).toBe(1);
    expect(breakdown.meanRatio).toBeNull();
    expect(breakdown.calibratedScore).toBeCloseTo(breakdown.projectedScore, 10);
  });
});
