import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import * as schedulerService from '../../scheduler/scheduler.service.js';
import * as flightService from '../flight.service.js';

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

describe('grading a review pumps the flight end to end', () => {
  it('accumulates grounded fill from real grading calls, leak-free', async () => {
    const learnerId = randomUUID();

    // First-ever-correct pays 5 points each; five items = 25 (grounded).
    for (const itemId of itemIds.slice(0, 5)) {
      await schedulerService.gradeReview(learnerId, itemId, 'good', null);
    }
    const grounded = await flightService.getFlightState(learnerId, qualificationId);
    expect(grounded.fill).toBe(25);
    expect(grounded.isAirborne).toBe(false);

    // A wrong answer pays 0 and must not change the flight at all.
    await schedulerService.gradeReview(learnerId, itemIds[5]!, 'again', null);
    const afterWrongAnswer = await flightService.getFlightState(learnerId, qualificationId);
    expect(afterWrongAnswer.fill).toBe(25);
  });

  it('awards "first_lift" exactly once, at the crossing', async () => {
    const learnerId = randomUUID();

    let state = await flightService.pump(learnerId, qualificationId, 60);
    expect(state.isAirborne).toBe(false);

    state = await flightService.pump(learnerId, qualificationId, 60);
    expect(state.isAirborne).toBe(true);

    const awardEvents = await prisma.flightEvent.findMany({
      where: { learnerId, eventType: 'AWARD_EARNED' },
    });
    expect(awardEvents).toHaveLength(1);
    expect(awardEvents[0]?.payload).toMatchObject({ awardSlug: 'first_lift' });

    // Pumping again after liftoff must not re-award it.
    await flightService.pump(learnerId, qualificationId, 10);
    const awardEventsAfter = await prisma.flightEvent.findMany({
      where: { learnerId, eventType: 'AWARD_EARNED' },
    });
    expect(awardEventsAfter).toHaveLength(1);
  });

  it('awards every altitude threshold a single big pump crosses at once', async () => {
    const learnerId = randomUUID();

    // One pump straight past 100, 200 and 300 should earn all three, not
    // just the highest one it happened to land on.
    const state = await flightService.pump(learnerId, qualificationId, 350);
    expect(state.fill).toBe(350);

    const awardEvents = await prisma.flightEvent.findMany({
      where: { learnerId, eventType: 'AWARD_EARNED' },
    });
    const slugs = awardEvents.map((e) => (e.payload as { awardSlug: string }).awardSlug).sort();
    expect(slugs).toEqual(['above_the_rooftops', 'first_lift', 'high_rise_view']);
  });
});

describe('getAwards', () => {
  it('returns the whole catalogue, earned and unearned', async () => {
    const learnerId = randomUUID();

    const beforeAny = await flightService.getAwards(learnerId);
    expect(beforeAny).toHaveLength(5);
    expect(beforeAny.every((a) => a.earnedAt === null)).toBe(true);

    await flightService.pump(learnerId, qualificationId, 150);
    const afterLiftoff = await flightService.getAwards(learnerId);

    const firstLift = afterLiftoff.find((a) => a.slug === 'first_lift');
    const theCeiling = afterLiftoff.find((a) => a.slug === 'the_ceiling');
    expect(firstLift?.earnedAt).not.toBeNull();
    expect(theCeiling?.earnedAt).toBeNull();
  });
});
