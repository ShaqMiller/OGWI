import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import * as contentGraphService from '../../content-graph/content-graph.service.js';
import * as examService from '../../exam/exam.service.js';
import * as readinessService from '../../readiness/readiness.service.js';
import * as recallService from '../../recall/recall.service.js';
import * as schedulerService from '../../scheduler/scheduler.service.js';
import * as masteryService from '../mastery.service.js';

/**
 * The downside ledger: everything that must NEVER lower a learner's mastery.
 *
 * Invariant 6 allows exactly two things to make mastery fall - a failed
 * previously-known item, or time decay. Everything else a learner can do is on
 * this list. The client's check-in script asks for this suite by name (§5).
 *
 * Each entry proves both halves: the live score does not move, and nothing is
 * written to the memory model. The CONTROL at the end proves the permitted
 * decline really does lower mastery, so the entries above it cannot be passing
 * simply because nothing is able to move.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

let qualificationId: string;
let passMark: number;
let moduleId: string;
let itemIds: string[];
let topicId: string;

beforeAll(async () => {
  const qualification = await prisma.qualification.findUniqueOrThrow({
    where: { slug: 'demo-cert' },
  });
  qualificationId = qualification.id;
  passMark = Number(qualification.passMark);

  const module = await prisma.module.findFirstOrThrow({ where: { qualificationId } });
  moduleId = module.id;

  const items = await prisma.knowledgeItem.findMany({
    where: { objective: { topic: { moduleId } } },
    select: { id: true },
  });
  itemIds = items.map((item) => item.id);

  const topic = await prisma.topic.findFirstOrThrow({ where: { name: 'IP Addressing' } });
  topicId = topic.id;
});

afterEach(() => {
  vi.useRealTimers();
});

async function liveScore(learnerId: string): Promise<number> {
  const scores = await masteryService.computeLiveModuleMastery(learnerId, qualificationId);
  return scores.find((score) => score.moduleId === moduleId)?.liveScore ?? 0;
}

/** Everything the memory model holds for a learner - any write shows up here. */
async function memoryModel(learnerId: string) {
  return {
    reviews: await prisma.reviewEvent.count({ where: { learnerId } }),
    states: await prisma.itemMemoryState.findMany({
      where: { learnerId },
      select: { knowledgeItemId: true, reps: true, lapses: true, stability: true },
      orderBy: { knowledgeItemId: 'asc' },
    }),
  };
}

/** A learner who has answered every item in the module correctly. */
async function knownLearner(): Promise<string> {
  const learnerId = randomUUID();
  for (const itemId of itemIds) {
    await schedulerService.gradeReview(learnerId, itemId, 'good', null, randomUUID());
  }
  return learnerId;
}

describe('the downside ledger - none of these lower mastery', () => {
  it('reading questions, qualifications and progress', async () => {
    const learnerId = await knownLearner();
    const scoreBefore = await liveScore(learnerId);
    const modelBefore = await memoryModel(learnerId);

    for (const itemId of itemIds) {
      await contentGraphService.getKnowledgeItemPrompt(itemId);
    }
    await contentGraphService.getQualificationBySlug('demo-cert');
    await contentGraphService.listQualifications();
    await recallService.getTopicKeyPoints(topicId);
    await readinessService.computeReadiness(learnerId, qualificationId, passMark);

    expect(await liveScore(learnerId)).toBeCloseTo(scoreBefore, 4);
    expect(await memoryModel(learnerId)).toEqual(modelBefore);
  });

  it('a blurt or Teach Oggi transcript, however much it misses', async () => {
    const learnerId = await knownLearner();
    const scoreBefore = await liveScore(learnerId);
    const modelBefore = await memoryModel(learnerId);

    await recallService.scoreText(topicId, 'Subnets split one network into smaller ones.');
    // A transcript that recalls nothing is still not a penalty.
    await recallService.scoreText(topicId, "I don't remember any of this.");

    expect(await liveScore(learnerId)).toBeCloseTo(scoreBefore, 4);
    expect(await memoryModel(learnerId)).toEqual(modelBefore);
  });

  it('starting an exam and saving answers, right or wrong, before submitting', async () => {
    const learnerId = await knownLearner();
    const scoreBefore = await liveScore(learnerId);
    const modelBefore = await memoryModel(learnerId);

    const { runId } = await examService.startRun(learnerId, 'demo-cert');
    const paper = await examService.getPaper(runId, learnerId);
    for (const question of paper.questions) {
      // Whatever is picked - exam answers are marked at submit, never on save.
      await examService.saveAnswer(runId, learnerId, question.knowledgeItemId, 0);
    }

    expect(await liveScore(learnerId)).toBeCloseTo(scoreBefore, 4);
    expect(await memoryModel(learnerId)).toEqual(modelBefore);
  });

  it('questions left blank in a submitted exam', async () => {
    const learnerId = await knownLearner();
    const scoreBefore = await liveScore(learnerId);
    const modelBefore = await memoryModel(learnerId);

    const { runId } = await examService.startRun(learnerId, 'demo-cert');
    await examService.submitRun(runId, learnerId);

    // Running out of time is not a memory failure, so a blank writes nothing.
    expect(await liveScore(learnerId)).toBeCloseTo(scoreBefore, 4);
    expect(await memoryModel(learnerId)).toEqual(modelBefore);
  });

  it('a wrong answer on an item never answered correctly', async () => {
    const learnerId = randomUUID();

    for (const itemId of itemIds) {
      await schedulerService.gradeReview(learnerId, itemId, 'again', null, randomUUID());
    }

    // Exactly 0, not "low". FSRS reports these items at R 1.0 right now, which
    // is precisely why mastery must not score an item before a correct answer.
    expect(await liveScore(learnerId)).toBe(0);
  });

  it('missed days - decay is the only effect, and a known item never resets', async () => {
    const learnerId = await knownLearner();
    const scoreBefore = await liveScore(learnerId);
    const modelBefore = await memoryModel(learnerId);

    // Only fake Date - faking timers too can stall Prisma's connection pool.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 60 * DAY_MS));

    const scoreAfterGap = await liveScore(learnerId);

    // Time decay is one of the two permitted declines, and proves the clock moved...
    expect(scoreAfterGap).toBeLessThan(scoreBefore);
    // ...but nothing expired or reset to unscored (invariant 7)...
    expect(scoreAfterGap).toBeGreaterThan(0);
    // ...and absence wrote nothing: no penalty event, no touched state.
    expect(await memoryModel(learnerId)).toEqual(modelBefore);
  });

  it.todo('using a hint - hints are not built yet, so this entry cannot be proven');
});

describe('an item enters scoring at its first correct answer', () => {
  it('scores nothing after a wrong answer, then scores once answered correctly', async () => {
    const learnerId = randomUUID();
    const [itemId] = itemIds;

    await schedulerService.gradeReview(learnerId, itemId!, 'again', null, randomUUID());
    expect(await liveScore(learnerId)).toBe(0);

    await schedulerService.gradeReview(learnerId, itemId!, 'good', null, randomUUID());
    expect(await liveScore(learnerId)).toBeGreaterThan(0);
  });
});

describe('CONTROL - the permitted decline really does lower mastery', () => {
  it('a wrong answer on a previously-known item lowers it', async () => {
    const steady = await knownLearner();
    const lapsed = await knownLearner();
    await schedulerService.gradeReview(lapsed, itemIds[0]!, 'again', null, randomUUID());

    // FSRS resets R to 1.0 on any review, so a lapse shows through lowered
    // stability - it needs a little time to become visible.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 3 * DAY_MS));

    expect(await liveScore(lapsed)).toBeLessThan(await liveScore(steady));
  });
});
