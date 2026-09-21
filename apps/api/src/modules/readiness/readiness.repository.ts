import { READINESS_MIN_RUN_QUESTION_COUNT } from '@ogwi/shared';
import { prisma } from '../../lib/prisma.js';
import type { CalibrationRunInput } from './calibration.util.js';

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

/**
 * When this learner last sat exam-format runs, for the certainty band.
 *
 * Queried here rather than through the exam module so readiness stays a leaf -
 * the same precedent as reading reviewEvent (scheduler's table) above.
 *
 * Only SIMULATION runs count: a learner-built CUSTOM test must never buy a
 * confident band. Fetches the WIDER window once; the pure util does both
 * counts.
 */
export async function findSubmittedExamRunDates(
  learnerId: string,
  qualificationId: string,
  since: Date,
): Promise<Date[]> {
  const rows = await prisma.examRun.findMany({
    where: {
      learnerId,
      qualificationId,
      kind: 'SIMULATION',
      status: 'SUBMITTED',
      submittedAt: { gte: since },
      questionCount: { gte: READINESS_MIN_RUN_QUESTION_COUNT },
    },
    select: { submittedAt: true },
  });

  return rows
    .map((row) => row.submittedAt)
    .filter((submittedAt): submittedAt is Date => submittedAt !== null);
}

/**
 * Submitted exam-simulation runs that carry a stored projection, for
 * calibration. Runs from before projections were recorded are skipped rather
 * than guessed at - their projection at the time is unknowable.
 */
export async function findCalibrationRuns(
  learnerId: string,
  qualificationId: string,
): Promise<CalibrationRunInput[]> {
  const rows = await prisma.examRun.findMany({
    where: {
      learnerId,
      qualificationId,
      kind: 'SIMULATION',
      status: 'SUBMITTED',
      questionCount: { gte: READINESS_MIN_RUN_QUESTION_COUNT },
      projectedScore: { not: null },
      submittedAt: { not: null },
      correctCount: { not: null },
      scoredCount: { not: null },
    },
    orderBy: { submittedAt: 'asc' },
    select: { submittedAt: true, correctCount: true, scoredCount: true, projectedScore: true },
  });

  return rows.map((row) => ({
    submittedAt: row.submittedAt as Date,
    correctCount: row.correctCount as number,
    scoredCount: row.scoredCount as number,
    projectedScore: row.projectedScore as number,
  }));
}
