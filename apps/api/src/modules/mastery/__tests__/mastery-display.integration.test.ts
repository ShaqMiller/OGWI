import { randomUUID } from 'node:crypto';
import type { MasteryView } from '@ogwi/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { moduleState } from '../mastery.service.js';

/**
 * Doc 2 B1's display layer: module states and the Biggest Opportunity, both
 * driven by the DISPLAYED score and both therefore stable between publish
 * points.
 */

const DAY_S = 24 * 60 * 60;

interface SeededItem {
  knowledgeItemId: string;
  renderingId: string;
  correctOptionIndex: number;
}

let items: SeededItem[];

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
});

const demoLearner = () => `demo-test-${randomUUID()}`;

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

async function readMastery(learnerId: string): Promise<MasteryView> {
  const res = await request(createApp()).get('/api/mastery/demo-cert').set('x-dev-learner-id', learnerId);
  expect(res.status).toBe(200);
  return res.body;
}

async function endSession(learnerId: string): Promise<MasteryView> {
  const res = await request(createApp()).post('/api/publishing/demo-cert').set('x-dev-learner-id', learnerId);
  expect(res.status).toBe(200);
  return res.body.mastery;
}

/** A single jump is capped at 60 days, so long waits are made of several. */
async function advanceDays(learnerId: string, days: number) {
  for (let remaining = days; remaining > 0; remaining -= 60) {
    const res = await request(createApp())
      .post('/api/dev/clock/advance')
      .set('x-dev-learner-id', learnerId)
      .send({ seconds: Math.min(60, remaining) * DAY_S });
    expect(res.status).toBe(200);
  }
}

describe('moduleState', () => {
  it('is mastered at or above the pass mark, and building below it until it has been', () => {
    expect(moduleState({ displayedScore: 0.7, everMastered: false, passMark: 0.7 })).toBe('mastered');
    expect(moduleState({ displayedScore: 0.69, everMastered: false, passMark: 0.7 })).toBe('building');
  });

  it('relaxes to "due for a refresh" once a mastered module decays back below', () => {
    expect(moduleState({ displayedScore: 0.69, everMastered: true, passMark: 0.7 })).toBe('due_for_refresh');
    // ...and flips back on recrossing.
    expect(moduleState({ displayedScore: 0.71, everMastered: true, passMark: 0.7 })).toBe('mastered');
  });
});

describe('the mastery view', () => {
  it('starts every module building, with the pass mark and the Biggest Opportunity', async () => {
    const view = await readMastery(randomUUID());

    expect(view.passMarkPercent).toBe(70);
    expect(view.modules.every((module) => module.state === 'building')).toBe(true);
    // Nothing published, so the whole course is still to come.
    expect(view.biggestOpportunity).toMatchObject({
      moduleName: 'Networking Basics',
      examSharePercent: 100,
      pointsBelowPassMark: 70,
    });
  });

  it('marks a module mastered at the publish point, and then has nothing to point at', async () => {
    const learnerId = demoLearner();
    await answerEverythingCorrectly(learnerId);

    // Answering doesn't move the displayed score, so the state holds too.
    expect((await readMastery(learnerId)).modules.every((module) => module.state === 'building')).toBe(true);

    const published = await endSession(learnerId);
    expect(published.modules.every((module) => module.state === 'mastered')).toBe(true);
    expect(published.biggestOpportunity).toBeNull();
  });

  it('relaxes to "due for a refresh" when the displayed score decays below the pass mark', async () => {
    const learnerId = demoLearner();
    await answerEverythingCorrectly(learnerId);
    await endSession(learnerId);

    // Long enough for the memory model to decay and the easing to catch up.
    await advanceDays(learnerId, 120);
    const view = await endSession(learnerId);

    expect(view.modules.every((module) => module.displayedScore < 0.7)).toBe(true);
    expect(view.modules.every((module) => module.state === 'due_for_refresh')).toBe(true);
    // A module below the bar is worth pointing at again.
    expect(view.biggestOpportunity?.moduleName).toBe('Networking Basics');
  });
});
