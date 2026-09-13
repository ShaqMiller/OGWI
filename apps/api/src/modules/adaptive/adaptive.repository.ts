import { prisma } from '../../lib/prisma.js';

/**
 * The only file in this module allowed to import the Prisma client.
 */

export interface ReviewEventWithModule {
  knowledgeItemId: string;
  grade: 'AGAIN' | 'GOOD';
  reviewedAt: Date;
  renderingId: string | null;
  idempotencyKey: string | null;
  moduleId: string;
  moduleName: string;
}

export async function findReviewEventsForQualification(
  learnerId: string,
  qualificationId: string,
): Promise<ReviewEventWithModule[]> {
  const rows = await prisma.reviewEvent.findMany({
    where: { learnerId, knowledgeItem: { objective: { topic: { module: { qualificationId } } } } },
    orderBy: { reviewedAt: 'asc' },
    select: {
      knowledgeItemId: true,
      grade: true,
      reviewedAt: true,
      renderingId: true,
      idempotencyKey: true,
      knowledgeItem: {
        select: {
          objective: {
            select: {
              topic: {
                select: {
                  module: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    knowledgeItemId: row.knowledgeItemId,
    grade: row.grade,
    reviewedAt: row.reviewedAt,
    renderingId: row.renderingId,
    idempotencyKey: row.idempotencyKey,
    moduleId: row.knowledgeItem.objective.topic.module.id,
    moduleName: row.knowledgeItem.objective.topic.module.name,
  }));
}
