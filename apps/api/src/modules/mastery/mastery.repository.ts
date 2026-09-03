import { prisma } from '../../lib/prisma.js';
import type { PersistedCardFields } from '../scheduler/fsrs.util.js';
import type { ModuleWithItems } from './mastery.types.js';

/**
 * The only file in this module allowed to import the Prisma client. Walks
 * the same content-graph relations content-graph.repository.ts reads
 * elsewhere - no new join logic invented, just a different shape of the
 * same tables.
 */

export async function findModulesForQualification(
  qualificationId: string,
): Promise<ModuleWithItems[]> {
  const modules = await prisma.module.findMany({
    where: { qualificationId },
    orderBy: { order: 'asc' },
    include: {
      topics: {
        include: {
          objectives: {
            include: { knowledgeItems: { select: { id: true } } },
          },
        },
      },
    },
  });

  return modules.map((module) => ({
    id: module.id,
    name: module.name,
    blueprintWeight: Number(module.blueprintWeight),
    objectives: module.topics.flatMap((topic) =>
      topic.objectives.map((objective) => ({
        id: objective.id,
        subWeight: objective.subWeight ? Number(objective.subWeight) : null,
        knowledgeItemIds: objective.knowledgeItems.map((item) => item.id),
      })),
    ),
  }));
}

export async function findItemMemoryStates(
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

export async function findPublishedRecord(
  learnerId: string,
  moduleId: string,
): Promise<{ displayedScore: number; lastPublishedAt: Date } | null> {
  return prisma.publishedMastery.findUnique({
    where: { learnerId_moduleId: { learnerId, moduleId } },
    select: { displayedScore: true, lastPublishedAt: true },
  });
}

export async function upsertPublishedScore(
  learnerId: string,
  moduleId: string,
  displayedScore: number,
): Promise<void> {
  // Both paths stamp the time from the same clock as publishModuleMastery
  // reads it. Leaving create to the column's @default(now()) meant the first
  // write used Postgres's clock and every later comparison used Node's, so
  // elapsed time could come out negative by a hair.
  const now = new Date();

  await prisma.publishedMastery.upsert({
    where: { learnerId_moduleId: { learnerId, moduleId } },
    create: { learnerId, moduleId, displayedScore, lastPublishedAt: now },
    update: { displayedScore, lastPublishedAt: now },
  });
}
