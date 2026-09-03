import { prisma } from '../../lib/prisma.js';
import type { PersistedCardFields } from '../scheduler/fsrs.util.js';
import type { TopicWithObjectives } from './composition.types.js';

/**
 * The only file in this module allowed to import the Prisma client.
 */

export async function findTopicsForQualification(
  qualificationId: string,
): Promise<TopicWithObjectives[]> {
  const modules = await prisma.module.findMany({
    where: { qualificationId },
    orderBy: { order: 'asc' },
    include: {
      topics: {
        orderBy: { order: 'asc' },
        include: {
          objectives: {
            include: { knowledgeItems: { select: { id: true } } },
          },
        },
      },
    },
  });

  return modules.flatMap((module) =>
    module.topics.map((topic) => ({
      topicId: topic.id,
      topicName: topic.name,
      topicOrder: topic.order,
      moduleId: module.id,
      moduleName: module.name,
      moduleOrder: module.order,
      hasActivitySlot: topic.hasActivitySlot,
      objectives: topic.objectives.map((objective) => ({
        id: objective.id,
        kind: objective.kind,
        knowledgeItemIds: objective.knowledgeItems.map((item) => item.id),
      })),
    })),
  );
}

export async function findItemStates(
  learnerId: string,
  knowledgeItemIds: string[],
): Promise<Map<string, PersistedCardFields>> {
  if (knowledgeItemIds.length === 0) return new Map();

  const rows = await prisma.itemMemoryState.findMany({
    where: { learnerId, knowledgeItemId: { in: knowledgeItemIds } },
  });

  return new Map(
    rows.map((row) => [
      row.knowledgeItemId,
      {
        difficulty: row.difficulty,
        stability: row.stability,
        due: row.due,
        lastReviewedAt: row.lastReviewedAt,
        scheduledDays: row.scheduledDays,
        learningSteps: row.learningSteps,
        reps: row.reps,
        lapses: row.lapses,
        state: row.state,
      },
    ]),
  );
}
