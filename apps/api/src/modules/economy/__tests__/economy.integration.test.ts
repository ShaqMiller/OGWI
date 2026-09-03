import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import * as schedulerService from '../../scheduler/scheduler.service.js';
import * as economyService from '../economy.service.js';

let qualificationId: string;
let itemIds: string[];

beforeAll(async () => {
  const qualification = await prisma.qualification.findUniqueOrThrow({
    where: { slug: 'demo-cert' },
  });
  qualificationId = qualification.id;

  const items = await prisma.knowledgeItem.findMany({
    where: { objective: { topic: { module: { qualificationId } } } },
    select: { id: true },
  });
  itemIds = items.map((item) => item.id);
});

describe('grading a review awards points end to end', () => {
  it('pays the first-correct rate on a brand-new item and 0 on a wrong answer', async () => {
    const learnerId = randomUUID();
    const [first, second] = itemIds;

    await schedulerService.gradeReview(learnerId, first!, 'good', null);
    await schedulerService.gradeReview(learnerId, second!, 'again', null);

    const balance = await economyService.getBalance(learnerId, qualificationId);
    expect(balance.totalPoints).toBe(5); // 5 for the first-ever correct, 0 for the miss
  });

  it('shows up in the recent events list', async () => {
    const learnerId = randomUUID();
    const [itemId] = itemIds;

    await schedulerService.gradeReview(learnerId, itemId!, 'good', null);
    const recent = await economyService.getRecentEvents(learnerId, qualificationId, 10);

    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ amount: 5, source: 'QUIZ_ANSWER', knowledgeItemId: itemId });
  });
});
