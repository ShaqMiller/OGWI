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

/**
 * Which of these items the learner has EVER answered correctly.
 *
 * An item enters mastery scoring at its first correct retrieval (Doc 2 B1).
 * Derived from the append-only review log rather than stored as a flag: no
 * migration, history already recorded counts automatically, and it is
 * permanent by construction - the log is never edited, so a known item can
 * never silently drop back out of scoring (invariant 7).
 */
export async function findItemsEverAnsweredCorrectly(
  learnerId: string,
  knowledgeItemIds: string[],
): Promise<Set<string>> {
  if (knowledgeItemIds.length === 0) return new Set();

  const rows = await prisma.reviewEvent.findMany({
    where: { learnerId, knowledgeItemId: { in: knowledgeItemIds }, grade: 'GOOD' },
    distinct: ['knowledgeItemId'],
    select: { knowledgeItemId: true },
  });

  return new Set(rows.map((row) => row.knowledgeItemId));
}

export async function findPublishedRecord(
  learnerId: string,
  moduleId: string,
): Promise<{ displayedScore: number; lastPublishedAt: Date; everMastered: boolean } | null> {
  return prisma.publishedMastery.findUnique({
    where: { learnerId_moduleId: { learnerId, moduleId } },
    select: { displayedScore: true, lastPublishedAt: true, everMastered: true },
  });
}

/** The qualification's pass mark - its record is the source of truth for every threshold. */
export async function findPassMark(qualificationId: string): Promise<number> {
  const row = await prisma.qualification.findUniqueOrThrow({
    where: { id: qualificationId },
    select: { passMark: true },
  });

  return Number(row.passMark);
}

export async function upsertPublishedScore(
  learnerId: string,
  moduleId: string,
  displayedScore: number,
  publishedAt: Date,
  mastered: boolean,
): Promise<void> {
  // Both paths take the time from the caller, which read it from the same
  // clock publishModuleMastery compares against. Leaving create to the
  // column's @default(now()) meant the first write used Postgres's clock and
  // every later comparison used Node's.
  await prisma.publishedMastery.upsert({
    where: { learnerId_moduleId: { learnerId, moduleId } },
    create: { learnerId, moduleId, displayedScore, lastPublishedAt: publishedAt, everMastered: mastered },
    // everMastered only ever turns on: reaching the pass mark is a fact about
    // the learner's history, not a state that decay takes back.
    update: {
      displayedScore,
      lastPublishedAt: publishedAt,
      ...(mastered ? { everMastered: true } : {}),
    },
  });
}

export async function findPublishedRecords(
  learnerId: string,
  moduleIds: string[],
): Promise<Map<string, { displayedScore: number; lastPublishedAt: Date; everMastered: boolean }>> {
  if (moduleIds.length === 0) return new Map();

  const rows = await prisma.publishedMastery.findMany({
    where: { learnerId, moduleId: { in: moduleIds } },
    select: { moduleId: true, displayedScore: true, lastPublishedAt: true, everMastered: true },
  });

  return new Map(
    rows.map((row) => [
      row.moduleId,
      {
        displayedScore: row.displayedScore,
        lastPublishedAt: row.lastPublishedAt,
        everMastered: row.everMastered,
      },
    ]),
  );
}

/** When the learner last answered anything in this qualification, or null if never. */
export async function findLastReviewedAt(
  learnerId: string,
  qualificationId: string,
): Promise<Date | null> {
  const result = await prisma.reviewEvent.aggregate({
    where: { learnerId, knowledgeItem: { objective: { topic: { module: { qualificationId } } } } },
    _max: { reviewedAt: true },
  });

  return result._max.reviewedAt;
}
