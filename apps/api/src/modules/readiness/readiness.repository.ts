import { prisma } from '../../lib/prisma.js';

/**
 * The only file in this module allowed to import the Prisma client for
 * readiness-specific queries. Module/item/state data is intentionally
 * *not* re-queried here - readiness.service reuses mastery.repository's
 * functions directly (same content-graph shape, no need to duplicate the
 * joins).
 */

/** Review-event counts per calendar day (UTC), for the pace/forecast calc. */
export async function findReviewCountsByDay(
  learnerId: string,
  qualificationId: string,
  since: Date,
): Promise<Map<string, number>> {
  const rows = await prisma.reviewEvent.findMany({
    where: {
      learnerId,
      reviewedAt: { gte: since },
      knowledgeItem: { objective: { topic: { module: { qualificationId } } } },
    },
    select: { reviewedAt: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const day = row.reviewedAt.toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return counts;
}
