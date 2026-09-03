import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import * as schedulerService from '../../scheduler/scheduler.service.js';
import * as readinessService from '../readiness.service.js';

let qualificationId: string;
let passMark: number;
let itemIds: string[];

beforeAll(async () => {
  const qualification = await prisma.qualification.findUniqueOrThrow({
    where: { slug: 'demo-cert' },
  });
  qualificationId = qualification.id;
  passMark = Number(qualification.passMark);

  const items = await prisma.knowledgeItem.findMany({
    where: { objective: { topic: { module: { qualificationId } } } },
    select: { id: true },
  });
  itemIds = items.map((item) => item.id);
});

describe('computeReadiness', () => {
  it('withholds the number and reports 0 coverage for an untouched learner', async () => {
    const learnerId = randomUUID();

    const result = await readinessService.computeReadiness(learnerId, qualificationId, passMark);

    expect(result.withheld).toBe(true);
    expect(result.oddsPercent).toBeNull();
    expect(result.weightedCoveragePercent).toBe(0);
    expect(result.certaintyBand).toBe('early');
    expect(result.forecast.itemsRemaining).toBe(itemIds.length);
  });

  it('rises in coverage and odds as more of the qualification is graded correctly', async () => {
    const learnerId = randomUUID();

    for (const itemId of itemIds) {
      await schedulerService.gradeReview(learnerId, itemId, 'good', null);
    }

    const result = await readinessService.computeReadiness(learnerId, qualificationId, passMark);

    expect(result.weightedCoveragePercent).toBe(100);
    expect(result.certaintyBand).toBe('solid');
    expect(result.forecast.itemsRemaining).toBe(0);
    // Fully covered and freshly graded -> comfortably above the withhold
    // threshold, so a real number should show.
    expect(result.withheld).toBe(false);
    expect(result.oddsPercent).not.toBeNull();
  });

  it('reports the qualification pass mark as a whole percentage', async () => {
    const learnerId = randomUUID();
    const result = await readinessService.computeReadiness(learnerId, qualificationId, 0.7);
    expect(result.passMarkPercent).toBe(70);
  });
});
