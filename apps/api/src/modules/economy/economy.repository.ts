import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';

/**
 * The only file in this module allowed to import the Prisma client.
 */

export async function recordLitreEvent(params: {
  learnerId: string;
  knowledgeItemId: string;
  source: 'QUIZ_ANSWER';
  amount: number;
  litreConfigVersion: string;
}): Promise<void> {
  await prisma.litreEvent.create({
    data: {
      learnerId: params.learnerId,
      knowledgeItemId: params.knowledgeItemId,
      source: params.source,
      amount: params.amount,
      litreConfigVersion: params.litreConfigVersion,
      effectiveAt: new Date(),
      // No client-supplied request id exists yet to make this truly
      // idempotent against a retried call - see the docs note on this
      // module. A fresh key per write at least satisfies the DB's
      // uniqueness guarantee structurally.
      idempotencyKey: randomUUID(),
    },
  });
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
