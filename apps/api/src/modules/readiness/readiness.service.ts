import {
  PACE_HALF_LIFE_DAYS,
  PACE_WINDOW_DAYS,
  READINESS_CELEBRATION_THRESHOLD,
  READINESS_DISPLAY_WITHHOLD_THRESHOLD,
  READINESS_FAIR_RUN_WINDOW_DAYS,
  READINESS_PROJECTION_DAYS,
  READINESS_SIGMA_BASE,
  READINESS_SIGMA_FLOOR,
} from '@ogwi/shared';
import * as masteryRepository from '../mastery/mastery.repository.js';
import { mean, scoringRetrievability, weightedObjectiveMean } from '../mastery/mastery.service.js';
import { resolveCertaintyBand } from './certainty-band.util.js';
import { normalCdf } from './normal-cdf.util.js';
import * as readinessRepository from './readiness.repository.js';
import type { CertaintyBand, ReadinessResult } from './readiness.types.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 *
 * Simplified from Doc 2 B2 - see packages/shared/src/constants/readiness.constants.ts
 * for what and why. One deliberate deviation remains:
 *   - sigma is a simple coverage-only heuristic (thin evidence -> wide
 *     uncertainty -> odds pulled toward the middle), not the spec's
 *     multi-factor formula. mu likewise has no calibration term
 *     (ratio = achieved score / projection), which exam runs now make
 *     possible but which is a separate piece of work.
 *
 * Certainty bands used to be a second deviation, computed from coverage
 * alone because no exam system existed to produce run evidence. Exam
 * Simulation produces it now, so the band applies the spec's full rule -
 * see certainty-band.util.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export async function computeReadiness(
  learnerId: string,
  qualificationId: string,
  passMark: number,
): Promise<ReadinessResult> {
  const now = new Date();
  const projectionDate = addDays(now, READINESS_PROJECTION_DAYS);

  const modules = await masteryRepository.findModulesForQualification(qualificationId);
  const allItemIds = modules.flatMap((m) => m.objectives.flatMap((o) => o.knowledgeItemIds));
  const [states, everCorrect] = await Promise.all([
    masteryRepository.findItemMemoryStates(learnerId, allItemIds),
    masteryRepository.findItemsEverAnsweredCorrectly(learnerId, allItemIds),
  ]);

  let mu = 0;
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

    mu += weightedObjectiveMean(projectedObjectiveScores) * module.blueprintWeight;
    weightedCoverage += weightedObjectiveMean(coverageObjectiveScores) * module.blueprintWeight;
  }

  const sigma = Math.max(READINESS_SIGMA_FLOOR, READINESS_SIGMA_BASE * (1 - weightedCoverage));
  const oddsRaw = normalCdf((mu - passMark) / sigma);
  const withheld = oddsRaw < READINESS_DISPLAY_WITHHOLD_THRESHOLD;

  const examRunDates = await readinessRepository.findSubmittedExamRunDates(
    learnerId,
    qualificationId,
    addDays(now, -READINESS_FAIR_RUN_WINDOW_DAYS),
  );
  const certaintyBand: CertaintyBand = resolveCertaintyBand(weightedCoverage, examRunDates, now);

  const coveredCount = allItemIds.filter((id) => states.has(id)).length;
  const itemsRemaining = allItemIds.length - coveredCount;
  const forecast = await computeForecast(learnerId, qualificationId, itemsRemaining, now);

  return {
    oddsPercent: withheld ? null : Math.round(oddsRaw * 100),
    withheld,
    weightedCoveragePercent: Math.round(weightedCoverage * 100),
    certaintyBand,
    passMarkPercent: Math.round(passMark * 100),
    qualityRatio: weightedCoverage > 0 ? mu / weightedCoverage : 0,
    celebrationEligible: oddsRaw >= READINESS_CELEBRATION_THRESHOLD,
    forecast,
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
