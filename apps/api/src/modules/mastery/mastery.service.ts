import { MASTERY_ROLLOVER_IDLE_MINUTES, type ModuleMastery } from '@ogwi/shared';
import * as clock from '../../lib/clock.js';
import { liveRetrievability, type PersistedCardFields } from '../scheduler/fsrs.util.js';
import { pickBiggestOpportunity, type BiggestOpportunity } from './biggest-opportunity.util.js';
import * as masteryRepository from './mastery.repository.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 */

const PUBLISH_HALF_LIFE_DAYS = 7;

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Module score = mean of its objectives' scores, sub-weighted where every
 * objective in the module has a published subWeight, equal split otherwise
 * (Doc 2 B1's mapping-table rule, applied across all of a module's
 * objectives regardless of which topic they sit under).
 */
export function weightedObjectiveMean(
  objectiveScores: { score: number; subWeight: number | null }[],
): number {
  if (objectiveScores.length === 0) return 0;

  const allWeighted = objectiveScores.every((o) => o.subWeight !== null);
  if (!allWeighted) {
    return mean(objectiveScores.map((o) => o.score));
  }

  const totalWeight = objectiveScores.reduce((sum, o) => sum + (o.subWeight as number), 0);
  if (totalWeight === 0) return mean(objectiveScores.map((o) => o.score));

  return objectiveScores.reduce(
    (sum, o) => sum + o.score * ((o.subWeight as number) / totalWeight),
    0,
  );
}

/**
 * An item's contribution to mastery at `at`. Doc 2 B1: "item mastery simply is
 * that item's current R, and an item only enters scoring at its first correct
 * retrieval".
 *
 * The gate is not a formality. FSRS resets retrievability to 1.0 on ANY review,
 * so scoring R alone made a WRONG first answer read as fully known - measured
 * at R 1.000 immediately and 0.766 a day later. Getting a question wrong raised
 * mastery, and raised the odds of passing with it.
 *
 * Once an item has been answered correctly it scores its live R from then on,
 * including after later wrong answers. That later fall is exactly the permitted
 * decline (invariant 6: "a failed previously-known item").
 *
 * Shared with readiness, so the two can never disagree about which items count.
 */
export function scoringRetrievability(
  state: PersistedCardFields | null,
  everAnsweredCorrectly: boolean,
  at: Date,
): number {
  if (!everAnsweredCorrectly) return 0;
  return liveRetrievability(state, at);
}

export async function computeLiveModuleMastery(
  learnerId: string,
  qualificationId: string,
): Promise<{ moduleId: string; moduleName: string; liveScore: number }[]> {
  const modules = await masteryRepository.findModulesForQualification(qualificationId);
  const now = clock.now();

  const allItemIds = modules.flatMap((m) => m.objectives.flatMap((o) => o.knowledgeItemIds));
  const [states, everCorrect] = await Promise.all([
    masteryRepository.findItemMemoryStates(learnerId, allItemIds),
    masteryRepository.findItemsEverAnsweredCorrectly(learnerId, allItemIds),
  ]);

  return modules.map((module) => {
    const objectiveScores = module.objectives.map((objective) => ({
      subWeight: objective.subWeight,
      score: mean(
        objective.knowledgeItemIds.map((itemId) =>
          scoringRetrievability(states.get(itemId) ?? null, everCorrect.has(itemId), now),
        ),
      ),
    }));

    return {
      moduleId: module.id,
      moduleName: module.name,
      liveScore: weightedObjectiveMean(objectiveScores),
    };
  });
}

/**
 * The kind-but-honest publish rule (Doc 2 B1): gains land instantly; a
 * decline eases toward the live value with a 7-day half-life rather than
 * dropping immediately. displayedScore only ever sits at-or-above live.
 */
export async function publishModuleMastery(
  learnerId: string,
  moduleId: string,
  liveScore: number,
): Promise<number> {
  const now = clock.now();
  const published = await masteryRepository.findPublishedRecord(learnerId, moduleId);

  let displayedScore: number;

  if (!published || liveScore >= published.displayedScore) {
    displayedScore = liveScore;
  } else {
    // Clamped at 0 so easing can only ever move a decline DOWN. Both stamps
    // now come from lib/clock, but a negative elapsed time once made a decline
    // nudge the displayed score up (when lastPublishedAt came from Postgres's
    // clock), and the clamp keeps that impossible.
    const elapsedDays = Math.max(
      0,
      (now.getTime() - published.lastPublishedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const decay = 1 - Math.pow(0.5, elapsedDays / PUBLISH_HALF_LIFE_DAYS);
    displayedScore = published.displayedScore + decay * (liveScore - published.displayedScore);
  }

  await masteryRepository.upsertPublishedScore(learnerId, moduleId, displayedScore, now);
  return displayedScore;
}

/**
 * Publishes every module in a qualification from live state - a publish point
 * (Doc 2 C4). Called at session end, practice-run end and exam submit, and by
 * the daily rollover below. Never by an ordinary read.
 */
export async function publishQualificationMastery(
  learnerId: string,
  qualificationId: string,
): Promise<ModuleMastery[]> {
  return publishLiveScores(learnerId, await computeLiveModuleMastery(learnerId, qualificationId));
}

async function publishLiveScores(
  learnerId: string,
  liveScores: { moduleId: string; moduleName: string; liveScore: number }[],
): Promise<ModuleMastery[]> {
  const results: ModuleMastery[] = [];
  for (const module of liveScores) {
    const displayedScore = await publishModuleMastery(learnerId, module.moduleId, module.liveScore);
    results.push({ ...module, displayedScore });
  }

  return results;
}

/**
 * Mastery as a learner sees it: live scores beside the last PUBLISHED value.
 *
 * This used to publish on every read, and the dashboard reads after every
 * answer - so displayed mastery republished mid-activity, which Doc 2 C4
 * forbids. A read now writes nothing (invariant 2), with one exception: the
 * daily rollover, materialised here on first read rather than by a background
 * job, the same way flight touchdown is.
 */
export async function getQualificationMastery(
  learnerId: string,
  qualificationId: string,
): Promise<ModuleMastery[]> {
  const liveScores = await computeLiveModuleMastery(learnerId, qualificationId);
  const [published, lastReviewedAt] = await Promise.all([
    masteryRepository.findPublishedRecords(learnerId, liveScores.map((module) => module.moduleId)),
    masteryRepository.findLastReviewedAt(learnerId, qualificationId),
  ]);

  const publishTimes = [...published.values()].map((record) => record.lastPublishedAt.getTime());
  const lastPublishedAt = publishTimes.length > 0 ? new Date(Math.max(...publishTimes)) : null;

  if (isDailyRolloverDue({ lastPublishedAt, lastReviewedAt, now: clock.now() })) {
    return publishLiveScores(learnerId, liveScores);
  }

  return liveScores.map((module) => ({
    ...module,
    // Never published: nothing has reached a publish point to show yet.
    displayedScore: published.get(module.moduleId)?.displayedScore ?? 0,
  }));
}

/**
 * Doc 2 C4's "one daily rollover during inactivity". Due when nothing has been
 * published since the last UTC midnight, there is something to publish, and
 * the learner hasn't answered for MASTERY_ROLLOVER_IDLE_MINUTES - so it can
 * never land mid-activity. Publishing stamps lastPublishedAt, which is what
 * keeps it to once a day.
 *
 * UTC rather than the learner's local midnight because no learner timezone
 * exists yet - the same scaffold simplification as remediation's day rule.
 */
export function isDailyRolloverDue(params: {
  lastPublishedAt: Date | null;
  lastReviewedAt: Date | null;
  now: Date;
}): boolean {
  const { lastPublishedAt, lastReviewedAt, now } = params;

  if (lastReviewedAt === null) return false;
  if (now.getTime() - lastReviewedAt.getTime() < MASTERY_ROLLOVER_IDLE_MINUTES * 60 * 1000) {
    return false;
  }

  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return lastPublishedAt === null || lastPublishedAt.getTime() < startOfToday;
}

/**
 * The Biggest Opportunity (Doc 2 B1) from the learner's DISPLAYED mastery -
 * the published layer drives it by the spec's honesty split. A module never
 * published counts as 0. Null when every module is at or above the pass mark.
 */
export async function findBiggestOpportunity(
  learnerId: string,
  qualificationId: string,
  passMark: number,
): Promise<BiggestOpportunity | null> {
  const modules = await masteryRepository.findModulesForQualification(qualificationId);
  const published = await masteryRepository.findPublishedRecords(
    learnerId,
    modules.map((module) => module.id),
  );

  return pickBiggestOpportunity(
    modules.map((module) => ({
      moduleId: module.id,
      moduleName: module.name,
      blueprintWeight: module.blueprintWeight,
      displayedScore: published.get(module.id)?.displayedScore ?? 0,
    })),
    passMark,
  );
}
