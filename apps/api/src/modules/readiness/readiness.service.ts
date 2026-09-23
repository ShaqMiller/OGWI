import {
  DESIRED_RETENTION,
  PACE_HALF_LIFE_DAYS,
  PACE_WINDOW_DAYS,
  READINESS_CELEBRATION_THRESHOLD,
  READINESS_DISPLAY_WITHHOLD_THRESHOLD,
  READINESS_FAIR_RUN_WINDOW_DAYS,
  READINESS_NEXT_ACTION_SESSION_ITEMS,
  READINESS_PROJECTION_DAYS,
  READINESS_SOLID_RUN_COUNT,
  READINESS_SOLID_RUN_WINDOW_DAYS,
  type NextAction,
  type PublishTrigger,
  type SigmaComponents,
  type UnlockChecklist,
} from '@ogwi/shared';
import * as clock from '../../lib/clock.js';
import * as compositionService from '../composition/composition.service.js';
import type { BiggestOpportunity } from '../mastery/biggest-opportunity.util.js';
import * as masteryRepository from '../mastery/mastery.repository.js';
import {
  findBiggestOpportunity,
  isDailyRolloverDue,
  mean,
  scoringRetrievability,
  weightedObjectiveMean,
} from '../mastery/mastery.service.js';
import type { ModuleWithItems } from '../mastery/mastery.types.js';
import { liveRetrievability, type PersistedCardFields } from '../scheduler/fsrs.util.js';
import { computeCalibration, type Calibration, type CalibrationRunInput } from './calibration.util.js';
import { resolveCertaintyBand } from './certainty-band.util.js';
import {
  CERTAINTY_BAND_RANK,
  chooseNextAction,
  scoreCandidate,
  withCorrectAnswers,
} from './next-action.util.js';
import { normalCdf } from './normal-cdf.util.js';
import { resolveHorizonDays } from './horizon.util.js';
import { decideCelebration, isForecastFrozen } from './publication-rules.util.js';
import * as readinessRepository from './readiness.repository.js';
import type {
  CertaintyBand,
  PublishedReadiness,
  ReadinessResult,
  ReadinessView,
} from './readiness.types.js';
import { computeSigma } from './sigma.util.js';
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
 * sigma combines the spec's four named ingredients - see sigma.util.ts. The
 * spec gives no formula for combining them, so that part is a default.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export interface ProjectionInputs {
  modules: ModuleWithItems[];
  states: Map<string, PersistedCardFields>;
  everCorrect: Set<string>;
}

interface Projection {
  /** mu before calibration: the predicted exam score 14 days out. */
  projectedScore: number;
  weightedCoverage: number;
  itemCount: number;
  coveredCount: number;
  /** Each item's projected probability of recall on exam day, for sigma's residual. */
  itemProbabilities: number[];
}

/** Everything the projection needs, read once. Live memory state only (invariant 5). */
async function loadProjectionInputs(
  learnerId: string,
  qualificationId: string,
): Promise<ProjectionInputs> {
  const modules = await masteryRepository.findModulesForQualification(qualificationId);
  const allItemIds = modules.flatMap((m) => m.objectives.flatMap((o) => o.knowledgeItemIds));
  const [states, everCorrect] = await Promise.all([
    masteryRepository.findItemMemoryStates(learnerId, allItemIds),
    masteryRepository.findItemsEverAnsweredCorrectly(learnerId, allItemIds),
  ]);

  return { modules, states, everCorrect };
}

/**
 * Step 1, pure: the projection from a given set of memory states. Pure so the
 * next-action simulation can ask "what if" without touching the database.
 */
export function projectFrom(inputs: ProjectionInputs, now: Date): Projection {
  const projectionDate = addDays(now, READINESS_PROJECTION_DAYS);
  const { modules, states, everCorrect } = inputs;
  const allItemIds = modules.flatMap((m) => m.objectives.flatMap((o) => o.knowledgeItemIds));

  const probabilityOf = (itemId: string) =>
    scoringRetrievability(states.get(itemId) ?? null, everCorrect.has(itemId), projectionDate);

  let projectedScore = 0;
  let weightedCoverage = 0;

  for (const module of modules) {
    const projectedObjectiveScores = module.objectives.map((objective) => ({
      subWeight: objective.subWeight,
      score: mean(objective.knowledgeItemIds.map(probabilityOf)),
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
    itemProbabilities: allItemIds.map(probabilityOf),
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
  const inputs = await loadProjectionInputs(learnerId, qualificationId);
  return projectFrom(inputs, clock.now()).projectedScore;
}

interface Evidence {
  inputs: ProjectionInputs;
  calibrationRuns: CalibrationRunInput[];
  examRunDates: Date[];
  passMark: number;
  now: Date;
}

interface OddsEvaluation {
  projection: Projection;
  calibration: Calibration;
  calibratedScore: number;
  sigma: number;
  sigmaComponents: SigmaComponents;
  oddsRaw: number;
  certaintyBand: CertaintyBand;
}

/**
 * Steps 1-3, pure: projection, calibration, sigma, odds and certainty from a
 * given body of evidence. Pure so the next action can ask "what if" by
 * handing it altered evidence.
 */
function evaluateOdds(evidence: Evidence): OddsEvaluation {
  const projection = projectFrom(evidence.inputs, evidence.now);
  const calibration = computeCalibration(evidence.calibrationRuns, evidence.now);
  const calibratedScore = Math.min(1, projection.projectedScore * calibration.ratio);

  const { sigma, components: sigmaComponents } = computeSigma({
    weightedCoverage: projection.weightedCoverage,
    projectedScore: projection.projectedScore,
    calibration,
    itemProbabilities: projection.itemProbabilities,
  });

  return {
    projection,
    calibration,
    calibratedScore,
    sigma,
    sigmaComponents,
    oddsRaw: normalCdf((calibratedScore - evidence.passMark) / sigma),
    certaintyBand: resolveCertaintyBand(projection.weightedCoverage, evidence.examRunDates, evidence.now),
  };
}

export async function computeReadiness(
  learnerId: string,
  qualificationId: string,
  passMark: number,
): Promise<ReadinessResult> {
  const now = clock.now();

  const [inputs, calibrationRuns, examRunDates, biggestOpportunity] = await Promise.all([
    loadProjectionInputs(learnerId, qualificationId),
    readinessRepository.findCalibrationRuns(learnerId, qualificationId),
    readinessRepository.findSubmittedExamRunDates(
      learnerId,
      qualificationId,
      addDays(now, -READINESS_FAIR_RUN_WINDOW_DAYS),
    ),
    findBiggestOpportunity(learnerId, qualificationId, passMark),
  ]);

  const evidence: Evidence = { inputs, calibrationRuns, examRunDates, passMark, now };
  const odds = evaluateOdds(evidence);
  const { projection, calibration, calibratedScore, sigma, sigmaComponents, oddsRaw, certaintyBand } = odds;
  const { weightedCoverage } = projection;

  const withheld = oddsRaw < READINESS_DISPLAY_WITHHOLD_THRESHOLD;

  const itemsRemaining = projection.itemCount - projection.coveredCount;
  const forecast = await computeForecast(learnerId, qualificationId, itemsRemaining, now);

  const nextActionCandidates = simulateNextActions(evidence, odds, biggestOpportunity);

  return {
    oddsPercent: withheld ? null : Math.round(oddsRaw * 100),
    withheld,
    weightedCoveragePercent: Math.round(weightedCoverage * 100),
    certaintyBand,
    passMarkPercent: Math.round(passMark * 100),
    qualityRatio: weightedCoverage > 0 ? calibratedScore / weightedCoverage : 0,
    celebrationEligible: oddsRaw >= READINESS_CELEBRATION_THRESHOLD,
    forecast,
    nextAction: chooseNextAction(nextActionCandidates),
    // Every ingredient of the number, so it can be walked through piece by
    // piece rather than taken on trust.
    breakdown: {
      projectedScore: projection.projectedScore,
      calibrationRatio: calibration.ratio,
      meanRatio: calibration.meanRatio,
      calibratedScore,
      sigma,
      sigmaComponents,
      passMark,
      oddsRaw,
      calibrationRuns: calibration.runs,
      nextActionCandidates,
    },
  };
}

/**
 * The next action's three candidates (Doc 2 B2), each simulated against the
 * learner's real evidence with one thing changed:
 *   (a) refresh - every item now due for review answered correctly, now.
 *   (b) biggest opportunity - a session on that module: its unseen items
 *       first, then its weakest, up to one quiz's worth, answered correctly.
 *   (c) mini-mock - offered when exam evidence is missing or stale (fewer
 *       runs in the last 30 days than a solid band needs), and simulated as a
 *       run that goes exactly as the calibration expects: the gain is the
 *       narrower uncertainty and any band step.
 * Each simulation answers correctly because the question is "what would doing
 * this do for you" - the realistic best case, not a prediction.
 */
function simulateNextActions(
  evidence: Evidence,
  current: OddsEvaluation,
  biggestOpportunity: BiggestOpportunity | null,
): NextAction[] {
  const { inputs, now } = evidence;
  const candidates: NextAction[] = [];

  const outcome = (simulated: OddsEvaluation) => ({
    oddsDelta: simulated.oddsRaw - current.oddsRaw,
    bandSteps: CERTAINTY_BAND_RANK[simulated.certaintyBand] - CERTAINTY_BAND_RANK[current.certaintyBand],
  });

  const answeredCorrectly = (itemIds: string[]) =>
    evaluateOdds({
      ...evidence,
      inputs: { ...inputs, ...withCorrectAnswers(inputs.states, inputs.everCorrect, itemIds, now) },
    });

  // (a) The largest decayed pool: everything the scheduler would call due.
  const due = [...inputs.states]
    .filter(([, state]) => liveRetrievability(state, now) <= DESIRED_RETENTION)
    .map(([itemId]) => itemId);
  if (due.length > 0) {
    const { oddsDelta, bandSteps } = outcome(answeredCorrectly(due));
    const noun = due.length === 1 ? 'question' : 'questions';
    candidates.push(
      scoreCandidate('refresh', `Refreshing the ${due.length} ${noun} due for review would lift this most.`, oddsDelta, bandSteps),
    );
  }

  // (b) A session on the Biggest Opportunity.
  const opportunityModule = biggestOpportunity
    ? inputs.modules.find((module) => module.id === biggestOpportunity.moduleId)
    : undefined;
  if (biggestOpportunity && opportunityModule) {
    const recall = (itemId: string) => {
      const state = inputs.states.get(itemId);
      return state ? liveRetrievability(state, now) : -1; // unseen first
    };
    const session = opportunityModule.objectives
      .flatMap((objective) => objective.knowledgeItemIds)
      .sort((a, b) => recall(a) - recall(b))
      .slice(0, READINESS_NEXT_ACTION_SESSION_ITEMS);

    const { oddsDelta, bandSteps } = outcome(answeredCorrectly(session));
    const share = Math.round(biggestOpportunity.blueprintWeight * 100);
    candidates.push(
      scoreCandidate(
        'biggest_opportunity',
        `A session on ${biggestOpportunity.moduleName} would lift this most - it's ${share}% of the exam.`,
        oddsDelta,
        bandSteps,
      ),
    );
  }

  // (c) A mini-mock, when exam evidence is missing or stale.
  const solidWindowStart = now.getTime() - READINESS_SOLID_RUN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentRuns = evidence.examRunDates.filter((date) => date.getTime() >= solidWindowStart).length;
  if (recentRuns < READINESS_SOLID_RUN_COUNT) {
    const expectedRatio = current.calibration.meanRatio ?? 1;
    const expectedScore = Math.min(1, current.projection.projectedScore * expectedRatio);
    const simulated = evaluateOdds({
      ...evidence,
      calibrationRuns: [
        ...evidence.calibrationRuns,
        {
          submittedAt: now,
          correctCount: Math.round(expectedScore * 1000),
          scoredCount: 1000,
          projectedScore: current.projection.projectedScore,
        },
      ],
      examRunDates: [...evidence.examRunDates, now],
    });

    const { oddsDelta, bandSteps } = outcome(simulated);
    const line =
      simulated.certaintyBand === 'solid' && bandSteps > 0
        ? 'One mini-mock would make this number solid.'
        : bandSteps > 0
          ? 'One mini-mock would firm this number up.'
          : 'A mini-mock would sharpen this number.';
    candidates.push(scoreCandidate('mini_mock', line, oddsDelta, bandSteps));
  }

  return candidates;
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
    return { expectedFinishDate: now.toISOString().slice(0, 10), itemsRemaining, paceItemsPerDay, frozen: false };
  }
  if (paceItemsPerDay <= 0) {
    return { expectedFinishDate: null, itemsRemaining, paceItemsPerDay, frozen: false };
  }

  const daysToFinish = itemsRemaining / paceItemsPerDay;
  return {
    expectedFinishDate: addDays(now, daysToFinish).toISOString().slice(0, 10),
    itemsRemaining,
    paceItemsPerDay,
    frozen: false,
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
  trigger: PublishTrigger,
): Promise<PublishedReadiness> {
  const passMark = await readinessRepository.findPassMark(qualificationId);
  const [result, checklist, previous, alreadyCelebrated, everUnlocked, lastReviewedAt] = await Promise.all([
    computeReadiness(learnerId, qualificationId, passMark),
    evaluateUnlockChecklist(learnerId, qualificationId),
    readinessRepository.findLatestPublication(learnerId, qualificationId),
    readinessRepository.hasCelebrated(learnerId, qualificationId),
    readinessRepository.hasUnlockedPublication(learnerId, qualificationId),
    masteryRepository.findLastReviewedAt(learnerId, qualificationId),
  ]);

  const now = clock.now();
  const { unlocked } = checklist;
  const frozenForecast =
    previous !== null && isForecastFrozen({ lastReviewedAt, now })
      ? { ...previous.forecast, frozen: true }
      : null;

  const forecast = frozenForecast ?? result.forecast;

  const published: PublishedReadiness = {
    ...result,
    oddsPercent: unlocked ? result.oddsPercent : null,
    celebrationEligible: unlocked && result.celebrationEligible,
    forecast,
    unlocked,
    // The scheduler reads this until the next publication (Doc 2 B2), so it
    // follows the forecast that was actually published, frozen or not.
    horizonDays: resolveHorizonDays({ expectedFinishDate: forecast.expectedFinishDate, now }),
    // Doc 2 B2's reveal: "Here's your first readiness score - it sharpens with
    // everything you do." True on exactly one publication.
    firstScore: unlocked && !everUnlocked,
    celebrate: decideCelebration({
      unlocked,
      oddsRaw: result.breakdown.oddsRaw,
      certaintyBand: result.certaintyBand,
      previous: previous && { unlocked: previous.unlocked, oddsRaw: previous.breakdown.oddsRaw },
      alreadyCelebrated,
    }),
    publishedAt: now,
  };

  await readinessRepository.createPublication(learnerId, qualificationId, published, trigger);
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
    return { checklist, published: await publishReadiness(learnerId, qualificationId, 'rollover') };
  }

  return { checklist, published: latest };
}
