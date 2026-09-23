import { READINESS_HORIZON_DEFAULT_DAYS } from '@ogwi/shared';
import { litreEventDataForReview } from '../economy/economy.repository.js';
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

export interface RecordedAnswer {
  grade: 'AGAIN' | 'GOOD';
  selectedOptionIndex: number | null;
  renderingId: string | null;
  pointsAwarded: number;
}

/** Looks up an already-recorded act, for replaying its result. */
export async function findRecordedAnswer(idempotencyKey: string): Promise<RecordedAnswer | null> {
  const [event, litre] = await Promise.all([
    prisma.reviewEvent.findUnique({ where: { idempotencyKey } }),
    prisma.litreEvent.findUnique({ where: { idempotencyKey: `${idempotencyKey}:litre` } }),
  ]);

  if (!event) return null;

  return {
    grade: event.grade,
    selectedOptionIndex: event.selectedOptionIndex,
    renderingId: event.renderingId,
    // The litre row is the record of what this act paid. Reporting it on a
    // replay lets a pump that was lost mid-request still complete.
    pointsAwarded: litre?.amount ?? 0,
  };
}

/**
 * Writes one graded answer: the review event, the updated memory state, and
 * the litre payment, atomically.
 *
 * The review-event insert is a CLAIM - `skipDuplicates` makes it
 * `INSERT ... ON CONFLICT DO NOTHING`, so a concurrent duplicate reports
 * `count: 0` rather than throwing. Race-safe by construction, the insert-side
 * twin of examRepository.claimForGrading, and a count-flow rather than
 * exception-flow like the rest of this codebase.
 *
 * Statement order is load-bearing: the claim goes FIRST, so a duplicate
 * blocks on the unique index, resolves to 0, and aborts before touching
 * ItemMemoryState at all. The transaction is also what makes the index
 * sufficient - without it, a duplicate that lost the race would already have
 * landed a stale memory-state upsert that nothing would roll back.
 *
 * Isolation is left at the Postgres default (READ COMMITTED). Unique-index
 * enforcement doesn't depend on isolation level, and SERIALIZABLE would only
 * add serialization failures that nothing here retries.
 */
export async function recordGradedAnswer(params: {
  idempotencyKey: string;
  learnerId: string;
  knowledgeItemId: string;
  renderingId: string | null;
  selectedOptionIndex: number | null;
  grade: 'AGAIN' | 'GOOD';
  reviewedAt: Date;
  predictedRetrievability: number | null;
  resulting: PersistedCardFields;
  schedulerConfigVersion: string;
  litre: { amount: number; litreConfigVersion: string; qualificationId: string } | null;
}): Promise<{ written: boolean }> {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.reviewEvent.createMany({
      data: [
        {
          idempotencyKey: params.idempotencyKey,
          learnerId: params.learnerId,
          knowledgeItemId: params.knowledgeItemId,
          renderingId: params.renderingId,
          selectedOptionIndex: params.selectedOptionIndex,
          grade: params.grade,
          reviewedAt: params.reviewedAt,
          predictedRetrievability: params.predictedRetrievability,
          resultingDifficulty: params.resulting.difficulty,
          resultingStability: params.resulting.stability,
          resultingDue: params.resulting.due,
          schedulerConfigVersion: params.schedulerConfigVersion,
        },
      ],
      skipDuplicates: true,
    });

    // Someone already recorded this act. Touch nothing else.
    if (claim.count === 0) return { written: false };

    await tx.itemMemoryState.upsert({
      where: {
        learnerId_knowledgeItemId: {
          learnerId: params.learnerId,
          knowledgeItemId: params.knowledgeItemId,
        },
      },
      create: {
        learnerId: params.learnerId,
        knowledgeItemId: params.knowledgeItemId,
        ...params.resulting,
        schedulerConfigVersion: params.schedulerConfigVersion,
      },
      update: {
        ...params.resulting,
        schedulerConfigVersion: params.schedulerConfigVersion,
      },
    });

    if (params.litre) {
      // Economy owns the row's shape; this module only owns the sequencing.
      await tx.litreEvent.create({
        data: litreEventDataForReview({
          idempotencyKey: `${params.idempotencyKey}:litre`,
          learnerId: params.learnerId,
          knowledgeItemId: params.knowledgeItemId,
          qualificationId: params.litre.qualificationId,
          amount: params.litre.amount,
          litreConfigVersion: params.litre.litreConfigVersion,
          effectiveAt: params.reviewedAt,
        }),
      });
    }

    return { written: true };
  });
}

export interface ReviewLogRow {
  knowledgeItemId: string;
  grade: 'AGAIN' | 'GOOD';
  reviewedAt: Date;
  predictedRetrievability: number | null;
  resultingDue: Date;
  idempotencyKey: string | null;
}

/** A learner's most recent review events in one qualification, newest first. */
export async function findReviewLog(
  learnerId: string,
  qualificationId: string,
  limit: number,
): Promise<ReviewLogRow[]> {
  return prisma.reviewEvent.findMany({
    where: { learnerId, knowledgeItem: { objective: { topic: { module: { qualificationId } } } } },
    orderBy: { reviewedAt: 'desc' },
    take: limit,
    select: {
      knowledgeItemId: true,
      grade: true,
      reviewedAt: true,
      predictedRetrievability: true,
      resultingDue: true,
      idempotencyKey: true,
    },
  });
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

/**
 * The learner's spacing horizon (Doc 2 B2), from their last readiness
 * publication. Read here rather than through the readiness module because
 * readiness reaches composition, which reaches this module - the same
 * leaf-read precedent readiness uses for exam runs.
 */
export async function findHorizonDays(learnerId: string, qualificationId: string): Promise<number> {
  const row = await prisma.readinessPublication.findFirst({
    where: { learnerId, qualificationId },
    orderBy: { publishedAt: 'desc' },
    select: { horizonDays: true },
  });

  return row?.horizonDays ?? READINESS_HORIZON_DEFAULT_DAYS;
}
