import {
  PACE_HALF_LIFE_DAYS,
  PACE_WINDOW_DAYS,
  READINESS_CELEBRATION_THRESHOLD,
  READINESS_DISPLAY_WITHHOLD_THRESHOLD,
  READINESS_FAIR_RUN_WINDOW_DAYS,
  READINESS_PROJECTION_DAYS,
  READINESS_SIGMA_BASE,
  READINESS_SIGMA_FLOOR,
  type UnlockChecklist,
} from '@ogwi/shared';
import * as clock from '../../lib/clock.js';
import * as compositionService from '../composition/composition.service.js';
import * as masteryRepository from '../mastery/mastery.repository.js';
import {
  isDailyRolloverDue,
  mean,
  scoringRetrievability,
  weightedObjectiveMean,
} from '../mastery/mastery.service.js';
import { computeCalibration } from './calibration.util.js';
import { resolveCertaintyBand } from './certainty-band.util.js';
import { normalCdf } from './normal-cdf.util.js';
import * as readinessRepository from './readiness.repository.js';
import type {
  CertaintyBand,
  PublishedReadiness,
  ReadinessResult,
  ReadinessView,
} from './readiness.types.js';
import { buildUnlockChecklist } from './unlock-checklist.util.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 *
 * Doc 2 B2, in three steps:
 *   1. Projection: every item's live R projected 14 days forward, aggregated
 *      through the mapping table into a predicted exam score.
 *   2. Calibration: that projection multiplied by how the learner actually
 *      performs under exam conditions - see calibration.util.ts.
 *   3. Odds: P(pass) = Phi((calibrated score - pass mark) / sigma).
 *
 * One deliberate deviation remains: sigma is a simple coverage-only heuristic
 * (thin evidence -> wide uncertainty -> odds pulled toward the middle), not the
 * spec's composite of coverage, run evidence, run-ratio spread and residual
 * variance, which it never gives a formula for.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

interface Projection {
  /** mu before calibration: the predicted exam score 14 days out. */
  projectedScore: number;
  weightedCoverage: number;
  itemCount: number;
  coveredCount: number;
}

/**
 * Step 1 on its own. Reads live memory state only (invariant 5) - never the
 * published mastery layer.
 */
async function computeProjection(
  learnerId: string,
  qualificationId: string,
  now: Date,
): Promise<Projection> {
  const projectionDate = addDays(now, READINESS_PROJECTION_DAYS);

  const modules = await masteryRepository.findModulesForQualification(qualificationId);
  const allItemIds = modules.flatMap((m) => m.objectives.flatMap((o) => o.knowledgeItemIds));
  const [states, everCorrect] = await Promise.all([
    masteryRepository.findItemMemoryStates(learnerId, allItemIds),
    masteryRepository.findItemsEverAnsweredCorrectly(learnerId, allItemIds),
  ]);

  let projectedScore = 0;
  let weightedCoverage = 0;

  for (const module of modules) {
    const projectedObjectiveScores = module.objectives.map((objective) => ({
      subWeight: objective.subWeight,
      score: mean(
        objective.knowledgeItemIds.map((itemId) =>
          scoringRetrievability(states.get(itemId) ?? null, everCorrect.has(itemId), projectionDate),
        ),
      ),
    }));
    // Coverage deliberately still counts ATTEMPTED items, wrong answers
    // included - the learner has met the material. Only the projection above
    // requires a correct answer, so wrong answers stop inflating the odds
    // without also hiding what has been attempted.
    const coverageObjectiveScores = module.objectives.map((objective) => ({
      subWeight: objective.subWeight,
      score: mean(objective.knowledgeItemIds.map((itemId) => (states.has(itemId) ? 1 : 0))),
    }));

    projectedScore += weightedObjectiveMean(projectedObjectiveScores) * module.blueprintWeight;
    weightedCoverage += weightedObjectiveMean(coverageObjectiveScores) * module.blueprintWeight;
  }

  return {
    projectedScore,
    weightedCoverage,
    itemCount: allItemIds.length,
    coveredCount: allItemIds.filter((id) => states.has(id)).length,
  };
}

/**
 * The uncalibrated projection right now. Exam submit stores this on the run
 * BEFORE the run's own answers are graded, which is what "the projection at
 * that moment" has to mean: grading the paper first would move the projection
 * toward the paper's own result and flatten every ratio toward 1.
 */
export async function computeProjectedScore(
  learnerId: string,
  qualificationId: string,
): Promise<number> {
  return (await computeProjection(learnerId, qualificationId, clock.now())).projectedScore;
}

export async function computeReadiness(
  learnerId: string,
  qualificationId: string,
  passMark: number,
): Promise<ReadinessResult> {
  const now = clock.now();

  const [projection, calibrationRuns, examRunDates] = await Promise.all([
    computeProjection(learnerId, qualificationId, now),
    readinessRepository.findCalibrationRuns(learnerId, qualificationId),
    readinessRepository.findSubmittedExamRunDates(
      learnerId,
      qualificationId,
      addDays(now, -READINESS_FAIR_RUN_WINDOW_DAYS),
    ),
  ]);

  const calibration = computeCalibration(calibrationRuns, now);
  const calibratedScore = Math.min(1, projection.projectedScore * calibration.ratio);
  const { weightedCoverage } = projection;

  const sigma = Math.max(READINESS_SIGMA_FLOOR, READINESS_SIGMA_BASE * (1 - weightedCoverage));
  const oddsRaw = normalCdf((calibratedScore - passMark) / sigma);
  const withheld = oddsRaw < READINESS_DISPLAY_WITHHOLD_THRESHOLD;

  const certaintyBand: CertaintyBand = resolveCertaintyBand(weightedCoverage, examRunDates, now);

  const itemsRemaining = projection.itemCount - projection.coveredCount;
  const forecast = await computeForecast(learnerId, qualificationId, itemsRemaining, now);

  return {
    oddsPercent: withheld ? null : Math.round(oddsRaw * 100),
    withheld,
    weightedCoveragePercent: Math.round(weightedCoverage * 100),
    certaintyBand,
    passMarkPercent: Math.round(passMark * 100),
    qualityRatio: weightedCoverage > 0 ? calibratedScore / weightedCoverage : 0,
    celebrationEligible: oddsRaw >= READINESS_CELEBRATION_THRESHOLD,
    forecast,
    // Every ingredient of the number, so it can be walked through piece by
    // piece rather than taken on trust.
    breakdown: {
      projectedScore: projection.projectedScore,
      calibrationRatio: calibration.ratio,
      meanRatio: calibration.meanRatio,
      calibratedScore,
      sigma,
      passMark,
      oddsRaw,
      calibrationRuns: calibration.runs,
    },
  };
}

async function computeForecast(
  learnerId: string,
  qualificationId: string,
  itemsRemaining: number,
  now: Date,
): Promise<ReadinessResult['forecast']> {
  const since = addDays(now, -PACE_WINDOW_DAYS);
  const countsByDay = await readinessRepository.findReviewCountsByDay(
    learnerId,
    qualificationId,
    since,
  );

  let weightedSum = 0;
  let weightTotal = 0;
  for (let daysAgo = 0; daysAgo < PACE_WINDOW_DAYS; daysAgo++) {
    const day = addDays(now, -daysAgo).toISOString().slice(0, 10);
    const count = countsByDay.get(day) ?? 0;
    const weight = Math.pow(0.5, daysAgo / PACE_HALF_LIFE_DAYS);
    weightedSum += count * weight;
    weightTotal += weight;
  }

  const paceItemsPerDay = weightTotal > 0 ? weightedSum / weightTotal : 0;

  if (itemsRemaining <= 0) {
    return { expectedFinishDate: now.toISOString().slice(0, 10), itemsRemaining, paceItemsPerDay };
  }
  if (paceItemsPerDay <= 0) {
    return { expectedFinishDate: null, itemsRemaining, paceItemsPerDay };
  }

  const daysToFinish = itemsRemaining / paceItemsPerDay;
  return {
    expectedFinishDate: addDays(now, daysToFinish).toISOString().slice(0, 10),
    itemsRemaining,
    paceItemsPerDay,
  };
}

/**
 * The first-score checklist, evaluated live: it ticks as items are earned,
 * rather than waiting for a publish point. It gates the odds; it isn't one.
 */
export async function evaluateUnlockChecklist(
  learnerId: string,
  qualificationId: string,
): Promise<UnlockChecklist> {
  const modules = await masteryRepository.findModulesForQualification(qualificationId);
  const itemIds = modules.flatMap((m) => m.objectives.flatMap((o) => o.knowledgeItemIds));

  const [states, completedTopics, submittedExamRuns] = await Promise.all([
    masteryRepository.findItemMemoryStates(learnerId, itemIds),
    compositionService.countCompletedTopics(learnerId, qualificationId),
    readinessRepository.countSubmittedExamRuns(learnerId, qualificationId),
  ]);

  const modulesTouched = modules.filter((module) =>
    module.objectives.some((objective) => objective.knowledgeItemIds.some((id) => states.has(id))),
  ).length;

  return buildUnlockChecklist({
    completedTopics,
    modulesTouched,
    moduleCount: modules.length,
    submittedExamRuns,
  });
}

/**
 * A publish point for the odds (Doc 2 B2: "recomputed only at publish
 * points"). Appends one publication; the latest is what the learner sees.
 *
 * "No score exists at all until the learner completes the unlock checklist":
 * a publication made before then stores every ingredient but no odds.
 */
export async function publishReadiness(
  learnerId: string,
  qualificationId: string,
): Promise<PublishedReadiness> {
  const passMark = await readinessRepository.findPassMark(qualificationId);
  const [result, checklist] = await Promise.all([
    computeReadiness(learnerId, qualificationId, passMark),
    evaluateUnlockChecklist(learnerId, qualificationId),
  ]);

  const published: PublishedReadiness = {
    ...result,
    oddsPercent: checklist.unlocked ? result.oddsPercent : null,
    celebrationEligible: checklist.unlocked && result.celebrationEligible,
    unlocked: checklist.unlocked,
    publishedAt: clock.now(),
  };

  await readinessRepository.createPublication(learnerId, qualificationId, published);
  return published;
}

/**
 * The odds as a learner sees them: the latest publication, plus the live
 * checklist. A read writes nothing, except the daily rollover - the same rule
 * and the same lazy materialisation as mastery's, so the two publish on the
 * same schedule without either calling the other.
 */
export async function getReadiness(learnerId: string, qualificationId: string): Promise<ReadinessView> {
  const [latest, lastReviewedAt, checklist] = await Promise.all([
    readinessRepository.findLatestPublication(learnerId, qualificationId),
    masteryRepository.findLastReviewedAt(learnerId, qualificationId),
    evaluateUnlockChecklist(learnerId, qualificationId),
  ]);

  const rolloverDue = isDailyRolloverDue({
    lastPublishedAt: latest?.publishedAt ?? null,
    lastReviewedAt,
    now: clock.now(),
  });

  if (rolloverDue) {
    return { checklist, published: await publishReadiness(learnerId, qualificationId) };
  }

  return { checklist, published: latest };
}
