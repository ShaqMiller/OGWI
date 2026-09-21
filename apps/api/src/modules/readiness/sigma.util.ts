import {
  EXAM_TARGET_QUESTION_COUNT,
  READINESS_SIGMA_BASE,
  READINESS_SIGMA_EVIDENCE_BASE,
  READINESS_SIGMA_FLOOR,
  type SigmaComponents,
} from '@ogwi/shared';
import type { Calibration } from './calibration.util.js';

/**
 * The uncertainty behind the odds (Doc 2 B2): "Composed from: untouched-
 * coverage share (dominant early) · exam-format evidence count and recency ·
 * spread between run ratios · residual projection variance - with a floor so
 * precision is never faked. Thin evidence widens sigma, pulling extreme odds
 * toward the middle automatically."
 *
 * The spec names the four ingredients but gives no formula, so this is a
 * default to confirm. Each ingredient is expressed in exam-score units (0-1)
 * and they combine as independent sources of error: sigma = sqrt(sum of
 * squares), never below the floor.
 *
 *   coverage  - SIGMA_BASE x the untouched share. The existing term; it
 *               dominates while most of the course is unseen.
 *   evidence  - EVIDENCE_BASE / (1 + recency-weighted exam runs). With no runs
 *               the projection is untested under exam conditions; each recent
 *               run shrinks it.
 *   spread    - how much the runs' calibration ratios disagree (weighted
 *               standard deviation), in score units. Needs two runs.
 *   residual  - sampling noise of sitting a real paper: even perfectly known
 *               recall probabilities give a varying score. sqrt(mean p(1-p) /
 *               paper length), with the paper as long as a full simulation.
 *
 * Pure: the caller supplies everything.
 */
export function computeSigma(input: {
  weightedCoverage: number;
  projectedScore: number;
  calibration: Calibration;
  /** Each item's projected probability of recall on exam day. */
  itemProbabilities: number[];
}): { sigma: number; components: SigmaComponents } {
  const calibrating = input.calibration.runs.filter((run) => run.ratio !== null);
  const effectiveRuns = calibrating.reduce((sum, run) => sum + run.weight, 0);

  const coverage = READINESS_SIGMA_BASE * (1 - input.weightedCoverage);
  const evidence = READINESS_SIGMA_EVIDENCE_BASE / (1 + effectiveRuns);
  const spread = calibrating.length >= 2 ? weightedStdDev(calibrating) * input.projectedScore : 0;
  const residual = residualSpread(input.itemProbabilities);

  const combined = Math.sqrt(coverage ** 2 + evidence ** 2 + spread ** 2 + residual ** 2);

  return {
    sigma: Math.max(READINESS_SIGMA_FLOOR, combined),
    components: { coverage, evidence, spread, residual },
  };
}

function weightedStdDev(runs: { ratio: number | null; weight: number }[]): number {
  const total = runs.reduce((sum, run) => sum + run.weight, 0);
  if (total <= 0) return 0;

  const mean = runs.reduce((sum, run) => sum + (run.ratio as number) * run.weight, 0) / total;
  const variance =
    runs.reduce((sum, run) => sum + run.weight * ((run.ratio as number) - mean) ** 2, 0) / total;

  return Math.sqrt(variance);
}

function residualSpread(probabilities: number[]): number {
  if (probabilities.length === 0) return 0;

  const meanVariance = probabilities.reduce((sum, p) => sum + p * (1 - p), 0) / probabilities.length;
  const paperLength = Math.min(probabilities.length, EXAM_TARGET_QUESTION_COUNT);

  return Math.sqrt(meanVariance / paperLength);
}
