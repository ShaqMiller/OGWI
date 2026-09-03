import {
  READINESS_FAIR_COVERAGE_THRESHOLD,
  READINESS_FAIR_RUN_COUNT,
  READINESS_FAIR_RUN_WINDOW_DAYS,
  READINESS_SOLID_COVERAGE_THRESHOLD,
  READINESS_SOLID_RUN_COUNT,
  READINESS_SOLID_RUN_WINDOW_DAYS,
  type CertaintyBand,
} from '@ogwi/shared';

/**
 * How confident the odds of passing are, per Doc 2 B2: "Solid = weighted
 * coverage >=70% and >=2 exam-format runs in 30 days · Fair = >=40% and >=1
 * run in 45 days · Early = anything less".
 *
 * Both halves of each rule now apply. The run half used to be dropped because
 * no exam system existed, which pinned the band at "early" forever; Exam
 * Simulation produces the evidence, so the shortcut is gone.
 *
 * The consequence is intended: coverage alone can no longer buy a confident
 * band. Having answered everything once says nothing about performing under
 * exam conditions, and claiming otherwise is exactly the flattery the
 * readiness module exists not to do.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function countWithin(runDates: Date[], now: Date, windowDays: number): number {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  return runDates.filter((date) => date.getTime() >= cutoff).length;
}

export function resolveCertaintyBand(
  weightedCoverage: number,
  submittedRunDates: Date[],
  now: Date,
): CertaintyBand {
  const solidRuns = countWithin(submittedRunDates, now, READINESS_SOLID_RUN_WINDOW_DAYS);
  if (
    weightedCoverage >= READINESS_SOLID_COVERAGE_THRESHOLD &&
    solidRuns >= READINESS_SOLID_RUN_COUNT
  ) {
    return 'solid';
  }

  const fairRuns = countWithin(submittedRunDates, now, READINESS_FAIR_RUN_WINDOW_DAYS);
  if (
    weightedCoverage >= READINESS_FAIR_COVERAGE_THRESHOLD &&
    fairRuns >= READINESS_FAIR_RUN_COUNT
  ) {
    return 'fair';
  }

  return 'early';
}
