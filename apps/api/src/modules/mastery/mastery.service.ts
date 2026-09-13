import type { ModuleMastery } from '@ogwi/shared';
import { liveRetrievability, type PersistedCardFields } from '../scheduler/fsrs.util.js';
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
  const now = new Date();

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
  const now = new Date();
  const published = await masteryRepository.findPublishedRecord(learnerId, moduleId);

  let displayedScore: number;

  if (!published || liveScore >= published.displayedScore) {
    displayedScore = liveScore;
  } else {
    // Clamped at 0 because the two timestamps can come from different clocks:
    // `now` is the Node process's, while lastPublishedAt is Postgres's on the
    // row's first write (@default(now())). When Postgres lands a hair ahead,
    // elapsed goes negative, decay goes negative, and a *decline* nudges the
    // displayed score up - the opposite of what easing is for. Tiny (~1e-9)
    // but real, and it made this path's test flaky.
    const elapsedDays = Math.max(
      0,
      (now.getTime() - published.lastPublishedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const decay = 1 - Math.pow(0.5, elapsedDays / PUBLISH_HALF_LIFE_DAYS);
    displayedScore = published.displayedScore + decay * (liveScore - published.displayedScore);
  }

  await masteryRepository.upsertPublishedScore(learnerId, moduleId, displayedScore);
  return displayedScore;
}

/**
 * Convenience for the API surface: computes live scores for every module in
 * a qualification and publishes each one, since there's no session-end
 * publish point yet (session composition doesn't exist). This is a scaffold
 * simplification, not the spec's real publish-point timing.
 */
export async function getAndPublishQualificationMastery(
  learnerId: string,
  qualificationId: string,
): Promise<ModuleMastery[]> {
  const liveScores = await computeLiveModuleMastery(learnerId, qualificationId);

  const results: ModuleMastery[] = [];
  for (const module of liveScores) {
    const displayedScore = await publishModuleMastery(learnerId, module.moduleId, module.liveScore);
    results.push({
      moduleId: module.moduleId,
      moduleName: module.moduleName,
      liveScore: module.liveScore,
      displayedScore,
    });
  }

  return results;
}
