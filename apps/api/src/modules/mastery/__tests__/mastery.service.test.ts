import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import * as schedulerService from '../../scheduler/scheduler.service.js';
import * as masteryService from '../mastery.service.js';

let qualificationId: string;
let moduleId: string;
let itemIds: string[];

beforeAll(async () => {
  const qualification = await prisma.qualification.findUniqueOrThrow({
    where: { slug: 'demo-cert' },
  });
  qualificationId = qualification.id;

  const module = await prisma.module.findFirstOrThrow({ where: { qualificationId } });
  moduleId = module.id;

  const items = await prisma.knowledgeItem.findMany({
    where: { objective: { topic: { moduleId } } },
    select: { id: true },
  });
  itemIds = items.map((item) => item.id);
});

describe('computeLiveModuleMastery', () => {
  it('scores an untouched module at 0', async () => {
    const learnerId = randomUUID();

    const scores = await masteryService.computeLiveModuleMastery(learnerId, qualificationId);
    const module = scores.find((m) => m.moduleId === moduleId);

    expect(module?.liveScore).toBe(0);
  });

  it('rises above 0 once every item in the module has been answered correctly', async () => {
    const learnerId = randomUUID();

    for (const itemId of itemIds) {
      await schedulerService.gradeReview(learnerId, itemId, 'good', null, randomUUID());
    }

    const scores = await masteryService.computeLiveModuleMastery(learnerId, qualificationId);
    const module = scores.find((m) => m.moduleId === moduleId);

    expect(module?.liveScore).toBeGreaterThan(0);
  });
});

describe('publishModuleMastery', () => {
  it('jumps straight to the live score on first publish (no prior published value)', async () => {
    const learnerId = randomUUID();

    for (const itemId of itemIds) {
      await schedulerService.gradeReview(learnerId, itemId, 'good', null, randomUUID());
    }

    const scores = await masteryService.computeLiveModuleMastery(learnerId, qualificationId);
    const liveScore = scores.find((m) => m.moduleId === moduleId)?.liveScore ?? 0;
    const displayed = await masteryService.publishModuleMastery(learnerId, moduleId, liveScore);

    expect(displayed).toBeCloseTo(liveScore, 10);
  });

  it('eases a decline instead of dropping the displayed score immediately', async () => {
    const learnerId = randomUUID();

    await masteryService.publishModuleMastery(learnerId, moduleId, 0.8);
    // Simulated decline, called immediately after (~0 elapsed time) - the
    // 7-day half-life means almost none of the drop should show up yet.
    const displayed = await masteryService.publishModuleMastery(learnerId, moduleId, 0.2);

    expect(displayed).toBeGreaterThan(0.79);
    expect(displayed).toBeLessThanOrEqual(0.8);
  });
});
