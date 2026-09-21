import {
  READINESS_CALIBRATION_HALF_LIFE_DAYS,
  READINESS_CALIBRATION_MAX_RATIO,
  READINESS_CALIBRATION_MIN_PROJECTION,
  READINESS_CALIBRATION_MIN_RATIO,
} from '@ogwi/shared';

/**
 * Exam-condition calibration (Doc 2 B2): "For each completed exam-format run:
 * ratio = achieved score / the projection at that moment. Calibrated mu =
 * projection x the recency-weighted mean ratio, clamped to [0.7, 1.1]. No runs
 * -> ratio 1.0."
 *
 * This is what stops the odds being the memory model marking its own homework:
 * a learner who scores below their projection under exam conditions gets more
 * cautious odds, and one who beats it gets a little credit - capped, so a single
 * lucky paper can't inflate the number much.
 *
 * Pure: the caller supplies the runs and `now`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CalibrationRunInput {
  submittedAt: Date;
  correctCount: number;
  scoredCount: number;
  /** The readiness projection when this run was submitted, before its own answers were graded. */
  projectedScore: number;
}

export interface CalibrationRunDetail {
  submittedAt: Date;
  achievedScore: number;
  projectedScore: number;
  /** Null when the run can't carry a ratio (see `ratioFor`) - it is then excluded from the mean. */
  ratio: number | null;
  /** Its share of the recency-weighted mean, before normalising. 0 when excluded. */
  weight: number;
}

export interface Calibration {
  /** What the projection is multiplied by: the clamped mean, or 1.0 when no run can calibrate. */
  ratio: number;
  /** The unclamped recency-weighted mean, or null when no run qualified. */
  meanRatio: number | null;
  runsUsed: number;
  runs: CalibrationRunDetail[];
}

/**
 * A run's ratio, or null when it can't honestly carry one.
 *
 * A projection near zero (a learner who had answered nothing correctly yet)
 * makes the ratio explode - one right answer over a projection of 0.01 is a
 * "ratio" of 100. The spec is silent on this; such runs still count as exam
 * evidence for the certainty band, they just don't calibrate.
 */
function ratioFor(run: CalibrationRunInput): number | null {
  if (run.scoredCount <= 0) return null;
  if (run.projectedScore < READINESS_CALIBRATION_MIN_PROJECTION) return null;
  return run.correctCount / run.scoredCount / run.projectedScore;
}

export function computeCalibration(runs: CalibrationRunInput[], now: Date): Calibration {
  let weightedSum = 0;
  let weightTotal = 0;

  const details: CalibrationRunDetail[] = runs.map((run) => {
    const ratio = ratioFor(run);
    const ageDays = Math.max(0, (now.getTime() - run.submittedAt.getTime()) / DAY_MS);
    const weight = ratio === null ? 0 : Math.pow(0.5, ageDays / READINESS_CALIBRATION_HALF_LIFE_DAYS);

    if (ratio !== null) {
      weightedSum += ratio * weight;
      weightTotal += weight;
    }

    return {
      submittedAt: run.submittedAt,
      achievedScore: run.scoredCount > 0 ? run.correctCount / run.scoredCount : 0,
      projectedScore: run.projectedScore,
      ratio,
      weight,
    };
  });

  const runsUsed = details.filter((detail) => detail.ratio !== null).length;
  const meanRatio = weightTotal > 0 ? weightedSum / weightTotal : null;
  const ratio =
    meanRatio === null
      ? 1
      : Math.min(READINESS_CALIBRATION_MAX_RATIO, Math.max(READINESS_CALIBRATION_MIN_RATIO, meanRatio));

  return { ratio, meanRatio, runsUsed, runs: details };
}
