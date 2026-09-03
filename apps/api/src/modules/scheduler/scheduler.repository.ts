import { prisma } from '../../lib/prisma.js';
import type { PersistedCardFields } from './fsrs.util.js';

/**
 * The only file in this module allowed to import the Prisma client.
 */

export async function findItemMemoryState(
  learnerId: string,
  knowledgeItemId: string,
): Promise<PersistedCardFields | null> {
  const row = await prisma.itemMemoryState.findUnique({
    where: { learnerId_knowledgeItemId: { learnerId, knowledgeItemId } },
  });

  if (!row) return null;

  return {
    difficulty: row.difficulty,
    stability: row.stability,
    due: row.due,
    lastReviewedAt: row.lastReviewedAt,
    scheduledDays: row.scheduledDays,
    learningSteps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
  };
}

export async function upsertItemMemoryState(
  learnerId: string,
  knowledgeItemId: string,
  fields: PersistedCardFields,
  schedulerConfigVersion: string,
): Promise<void> {
  await prisma.itemMemoryState.upsert({
    where: { learnerId_knowledgeItemId: { learnerId, knowledgeItemId } },
    create: {
      learnerId,
      knowledgeItemId,
      difficulty: fields.difficulty,
      stability: fields.stability,
      due: fields.due,
      lastReviewedAt: fields.lastReviewedAt,
      scheduledDays: fields.scheduledDays,
      learningSteps: fields.learningSteps,
      reps: fields.reps,
      lapses: fields.lapses,
      state: fields.state,
      schedulerConfigVersion,
    },
    update: {
      difficulty: fields.difficulty,
      stability: fields.stability,
      due: fields.due,
      lastReviewedAt: fields.lastReviewedAt,
      scheduledDays: fields.scheduledDays,
      learningSteps: fields.learningSteps,
      reps: fields.reps,
      lapses: fields.lapses,
      state: fields.state,
      schedulerConfigVersion,
    },
  });
}

export async function recordReviewEvent(params: {
  learnerId: string;
  knowledgeItemId: string;
  renderingId: string | null;
  grade: 'AGAIN' | 'GOOD';
  resultingDifficulty: number;
  resultingStability: number;
  resultingDue: Date;
  schedulerConfigVersion: string;
}): Promise<void> {
  await prisma.reviewEvent.create({ data: params });
}

/**
 * Simplified stand-in for the spec's "opener": due items first, padded with
 * never-reviewed items if there aren't enough due yet. No remediation
 * ladder, no never-empty-with-fallback-to-lowest-R guarantee - those need
 * the adaptive engine and session composition, which don't exist yet.
 */
export async function findDueItems(
  learnerId: string,
  qualificationId: string,
  limit: number,
  now: Date,
): Promise<{ dueStates: { knowledgeItemId: string; due: Date }[]; newItemIds: string[] }> {
  const scopeWhere = {
    objective: { topic: { module: { qualificationId } } },
  };

  const dueStates = await prisma.itemMemoryState.findMany({
    where: { learnerId, due: { lte: now }, knowledgeItem: scopeWhere },
    orderBy: { due: 'asc' },
    take: limit,
    select: { knowledgeItemId: true, due: true },
  });

  const remaining = limit - dueStates.length;
  const newItems =
    remaining > 0
      ? await prisma.knowledgeItem.findMany({
          where: { ...scopeWhere, itemMemoryStates: { none: { learnerId } } },
          take: remaining,
          select: { id: true },
        })
      : [];

  return { dueStates, newItemIds: newItems.map((item) => item.id) };
}
