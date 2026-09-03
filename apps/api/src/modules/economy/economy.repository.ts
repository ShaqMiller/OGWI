import { prisma } from '../../lib/prisma.js';

/**
 * The only file in this module allowed to import the Prisma client.
 */

/**
 * The row shape for litres paid on a graded answer.
 *
 * Pure - it builds the `data` object and does not write. The write happens
 * inside scheduler.repository's transaction, so the review event, the memory
 * state and the payment commit together or not at all. Economy still owns
 * what a litre row LOOKS like; the scheduler only owns when it is issued.
 *
 * `idempotencyKey` is now derived from the learning act rather than a fresh
 * randomUUID(). The old key satisfied the unique constraint on every call and
 * therefore could never fire - the constraint was decorative. LitreEvent has
 * no annulment or compensating-event model (unlike FlightEvent), and
 * sumPointsForQualification blind-SUMs, so a duplicate that lands is
 * permanently unfixable. This key is the only thing preventing that.
 */
export function litreEventDataForReview(params: {
  idempotencyKey: string;
  learnerId: string;
  knowledgeItemId: string;
  amount: number;
  litreConfigVersion: string;
}) {
  return {
    learnerId: params.learnerId,
    knowledgeItemId: params.knowledgeItemId,
    source: 'QUIZ_ANSWER' as const,
    amount: params.amount,
    litreConfigVersion: params.litreConfigVersion,
    effectiveAt: new Date(),
    idempotencyKey: params.idempotencyKey,
  };
}

export async function sumPointsForQualification(
  learnerId: string,
  qualificationId: string,
): Promise<number> {
  const result = await prisma.litreEvent.aggregate({
    where: { learnerId, knowledgeItem: { objective: { topic: { module: { qualificationId } } } } },
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

export interface RecentLitreEvent {
  amount: number;
  source: string;
  knowledgeItemId: string | null;
  effectiveAt: Date;
}

export async function findRecentEvents(
  learnerId: string,
  qualificationId: string,
  limit: number,
): Promise<RecentLitreEvent[]> {
  return prisma.litreEvent.findMany({
    where: { learnerId, knowledgeItem: { objective: { topic: { module: { qualificationId } } } } },
    orderBy: { effectiveAt: 'desc' },
    take: limit,
    select: { amount: true, source: true, knowledgeItemId: true, effectiveAt: true },
  });
}
