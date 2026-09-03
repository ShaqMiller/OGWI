import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import * as schedulerService from '../scheduler.service.js';

/**
 * Exercises the FSRS-backed scheduler against the seeded "demo-cert"
 * content (apps/api/prisma/seed.ts) and a real local Postgres, same
 * pattern as health.test.ts. Each test run uses a fresh random learnerId so
 * runs don't interfere with each other's memory state.
 */

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

  if (itemIds.length < 2) {
    throw new Error('Seed data missing - run `pnpm --filter @ogwi/api db:seed` first');
  }
});

describe('gradeReview', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a memory state on first review', async () => {
    const learnerId = randomUUID();
    const [itemId] = itemIds;

    const first = await schedulerService.gradeReview(learnerId, itemId!, 'good', null);
    expect(first.reps).toBe(1);
    expect(first.stability).toBeGreaterThan(0);
    expect(first.due.getTime()).toBeGreaterThan(Date.now());
  });

  it('grows stability when a second correct answer arrives weeks later', async () => {
    const learnerId = randomUUID();
    const [itemId] = itemIds;

    const first = await schedulerService.gradeReview(learnerId, itemId!, 'good', null);

    // A brand-new item's first Good graduates it out of FSRS's short-term
    // learning steps (verified directly against ts-fsrs: grading again
    // right at the learning-step due date advances state but leaves
    // stability untouched - only a real elapsed gap feeds the long-term
    // recall-stability formula). 30 days is comfortably past that.
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    // Only fake Date - faking timers too can stall Prisma's connection pool.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(first.due.getTime() + THIRTY_DAYS_MS));

    const second = await schedulerService.gradeReview(learnerId, itemId!, 'good', null);
    expect(second.reps).toBe(2);
    expect(second.stability).toBeGreaterThan(first.stability);
    expect(second.due.getTime()).toBeGreaterThan(first.due.getTime());
  });

  it('leaves a correctly-answered item more stable than an incorrectly-answered one', async () => {
    const learnerId = randomUUID();
    const [goodItemId, againItemId] = itemIds;

    const goodResult = await schedulerService.gradeReview(learnerId, goodItemId!, 'good', null);
    const againResult = await schedulerService.gradeReview(learnerId, againItemId!, 'again', null);

    expect(goodResult.stability).toBeGreaterThan(againResult.stability);
  });
});

describe('getDueItems', () => {
  it('returns never-reviewed items as "new" when nothing is due yet', async () => {
    const learnerId = randomUUID();

    const due = await schedulerService.getDueItems(learnerId, qualificationId, 8);

    expect(due.length).toBeGreaterThan(0);
    expect(due.every((item) => item.isNew)).toBe(true);
  });

  it('stops surfacing an item as new immediately after it is graded', async () => {
    const learnerId = randomUUID();
    const [itemId] = itemIds;

    await schedulerService.gradeReview(learnerId, itemId!, 'good', null);
    const due = await schedulerService.getDueItems(learnerId, qualificationId, itemIds.length);

    const stillNew = due.find((item) => item.knowledgeItemId === itemId && item.isNew);
    expect(stillNew).toBeUndefined();
  });
});
