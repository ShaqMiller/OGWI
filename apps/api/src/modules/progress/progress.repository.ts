import { prisma } from '../../lib/prisma.js';
import { utcDay } from './week.util.js';

/**
 * The only file in this module allowed to import the Prisma client.
 *
 * Progress is a page-level view: it reads what the owning modules have already
 * written (litre events, review events, readiness publications) and computes
 * nothing of its own. Same leaf-read precedent as readiness reading exam runs.
 */

/** Litres earned per UTC day in a window. Days with nothing earned are simply absent. */
export async function findLitresByDay(
  learnerId: string,
  qualificationId: string,
  from: Date,
  to: Date,
): Promise<Map<string, number>> {
  const rows = await prisma.litreEvent.findMany({
    where: { learnerId, qualificationId, effectiveAt: { gte: from, lt: to } },
    select: { effectiveAt: true, amount: true },
  });

  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = utcDay(row.effectiveAt);
    byDay.set(day, (byDay.get(day) ?? 0) + row.amount);
  }

  return byDay;
}

export async function countAnswers(
  learnerId: string,
  qualificationId: string,
  from: Date,
  to: Date,
): Promise<number> {
  return prisma.reviewEvent.count({
    where: {
      learnerId,
      reviewedAt: { gte: from, lt: to },
      knowledgeItem: { objective: { topic: { module: { qualificationId } } } },
    },
  });
}

/**
 * Sessions finished in the window: publish points the learner caused, which is
 * every publication except the daily rollover.
 */
export async function countSessions(
  learnerId: string,
  qualificationId: string,
  from: Date,
  to: Date,
): Promise<number> {
  return prisma.readinessPublication.count({
    where: {
      learnerId,
      qualificationId,
      publishedAt: { gte: from, lt: to },
      trigger: { not: 'rollover' },
    },
  });
}

/**
 * When each item was first answered. A topic is complete once every item in it
 * has been answered at least once, so the last of these is when that happened.
 */
export async function findFirstAnsweredAt(
  learnerId: string,
  qualificationId: string,
): Promise<Map<string, Date>> {
  const rows = await prisma.reviewEvent.groupBy({
    by: ['knowledgeItemId'],
    where: {
      learnerId,
      knowledgeItem: { objective: { topic: { module: { qualificationId } } } },
    },
    _min: { reviewedAt: true },
  });

  return new Map(
    rows
      .filter((row) => row._min.reviewedAt !== null)
      .map((row) => [row.knowledgeItemId, row._min.reviewedAt as Date]),
  );
}
