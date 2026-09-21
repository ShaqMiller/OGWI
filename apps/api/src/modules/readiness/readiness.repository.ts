import {
  READINESS_CONFIG_VERSION,
  READINESS_MIN_RUN_QUESTION_COUNT,
  type CalibrationRun,
} from '@ogwi/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { CalibrationRunInput } from './calibration.util.js';
import type { CertaintyBand, PublishedReadiness } from './readiness.types.js';

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

/** Every submitted exam simulation, ever - the unlock checklist's "complete one mini-mock". */
export async function countSubmittedExamRuns(
  learnerId: string,
  qualificationId: string,
): Promise<number> {
  return prisma.examRun.count({
    where: {
      learnerId,
      qualificationId,
      kind: 'SIMULATION',
      status: 'SUBMITTED',
      questionCount: { gte: READINESS_MIN_RUN_QUESTION_COUNT },
    },
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

export async function createPublication(
  learnerId: string,
  qualificationId: string,
  published: PublishedReadiness,
): Promise<void> {
  const { breakdown, forecast } = published;

  await prisma.readinessPublication.create({
    data: {
      learnerId,
      qualificationId,
      publishedAt: published.publishedAt,
      unlocked: published.unlocked,
      oddsPercent: published.oddsPercent,
      withheld: published.withheld,
      weightedCoveragePercent: published.weightedCoveragePercent,
      certaintyBand: published.certaintyBand,
      passMarkPercent: published.passMarkPercent,
      qualityRatio: published.qualityRatio,
      celebrationEligible: published.celebrationEligible,
      forecastFinishDate: forecast.expectedFinishDate,
      forecastItemsRemaining: forecast.itemsRemaining,
      forecastPaceItemsPerDay: forecast.paceItemsPerDay,
      projectedScore: breakdown.projectedScore,
      calibrationRatio: breakdown.calibrationRatio,
      meanRatio: breakdown.meanRatio,
      calibratedScore: breakdown.calibratedScore,
      sigma: breakdown.sigma,
      passMark: breakdown.passMark,
      oddsRaw: breakdown.oddsRaw,
      calibrationRuns: breakdown.calibrationRuns.map((run) => ({
        ...run,
        submittedAt: run.submittedAt.toISOString(),
      })) as Prisma.InputJsonValue,
      readinessConfigVersion: READINESS_CONFIG_VERSION,
    },
  });
}

export async function findLatestPublication(
  learnerId: string,
  qualificationId: string,
): Promise<PublishedReadiness | null> {
  const row = await prisma.readinessPublication.findFirst({
    where: { learnerId, qualificationId },
    orderBy: { publishedAt: 'desc' },
  });

  if (!row) return null;

  const storedRuns = row.calibrationRuns as (Omit<CalibrationRun, 'submittedAt'> & { submittedAt: string })[];

  return {
    unlocked: row.unlocked,
    publishedAt: row.publishedAt,
    oddsPercent: row.oddsPercent,
    withheld: row.withheld,
    weightedCoveragePercent: row.weightedCoveragePercent,
    certaintyBand: row.certaintyBand as CertaintyBand,
    passMarkPercent: row.passMarkPercent,
    qualityRatio: row.qualityRatio,
    celebrationEligible: row.celebrationEligible,
    forecast: {
      expectedFinishDate: row.forecastFinishDate,
      itemsRemaining: row.forecastItemsRemaining,
      paceItemsPerDay: row.forecastPaceItemsPerDay,
    },
    breakdown: {
      projectedScore: row.projectedScore,
      calibrationRatio: row.calibrationRatio,
      meanRatio: row.meanRatio,
      calibratedScore: row.calibratedScore,
      sigma: row.sigma,
      passMark: row.passMark,
      oddsRaw: row.oddsRaw,
      calibrationRuns: storedRuns.map((run) => ({ ...run, submittedAt: new Date(run.submittedAt) })),
    },
  };
}
