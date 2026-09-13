import { Prisma } from '@prisma/client';
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
  qualificationId: string;
  amount: number;
  litreConfigVersion: string;
  effectiveAt: Date;
}) {
  return {
    learnerId: params.learnerId,
    knowledgeItemId: params.knowledgeItemId,
    qualificationId: params.qualificationId,
    source: 'QUIZ_ANSWER' as const,
    amount: params.amount,
    litreConfigVersion: params.litreConfigVersion,
    effectiveAt: params.effectiveAt,
    idempotencyKey: params.idempotencyKey,
  };
}

export async function sumPointsForQualification(
  learnerId: string,
  qualificationId: string,
): Promise<number> {
  const result = await prisma.litreEvent.aggregate({
    // By the row's own qualification, never through its knowledge item: an
    // exam completion premium has no knowledge item, so joining through one
    // dropped every premium from the balance.
    where: { learnerId, qualificationId },
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
    // Same reason as the balance: premiums have no knowledge item to join through.
    where: { learnerId, qualificationId },
    orderBy: { effectiveAt: 'desc' },
    take: limit,
    select: { amount: true, source: true, knowledgeItemId: true, effectiveAt: true },
  });
}

/**
 * Writes a run's completion premium.
 *
 * `source: 'ASSESSMENT'` with a null knowledgeItemId, because the premium is
 * paid for finishing a RUN, not for any one question - attributing it to a
 * question would misreport what earned it in the Recent list. Doc 2 B8 calls
 * litre events "source-itemised", and this is the honest itemisation.
 *
 * Returns false when the premium was already paid: the unique idempotency key
 * makes a resubmitted run a no-op rather than a double payment.
 */
export async function recordExamPremium(params: {
  learnerId: string;
  qualificationId: string;
  amount: number;
  idempotencyKey: string;
  litreConfigVersion: string;
  effectiveAt: Date;
}): Promise<boolean> {
  try {
    await prisma.litreEvent.create({
      data: {
        learnerId: params.learnerId,
        knowledgeItemId: null,
        qualificationId: params.qualificationId,
        source: 'ASSESSMENT',
        amount: params.amount,
        litreConfigVersion: params.litreConfigVersion,
        effectiveAt: params.effectiveAt,
        idempotencyKey: params.idempotencyKey,
      },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

/**
 * What a specific set of learning acts paid, by their idempotency keys.
 *
 * Reads what was actually written rather than recomputing it - per-question
 * pricing depends on the memory state at the moment of the answer, which
 * cannot be reconstructed afterwards.
 */
export async function sumAmountsForKeys(idempotencyKeys: string[]): Promise<number> {
  if (idempotencyKeys.length === 0) return 0;

  const result = await prisma.litreEvent.aggregate({
    where: { idempotencyKey: { in: idempotencyKeys } },
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}
