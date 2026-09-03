import type { ModuleMastery } from '@ogwi/shared';
import { liveRetrievability } from '../scheduler/fsrs.util.js';
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

export async function computeLiveModuleMastery(
  learnerId: string,
  qualificationId: string,
): Promise<{ moduleId: string; moduleName: string; liveScore: number }[]> {
  const modules = await masteryRepository.findModulesForQualification(qualificationId);
  const now = new Date();

  const allItemIds = modules.flatMap((m) => m.objectives.flatMap((o) => o.knowledgeItemIds));
  const states = await masteryRepository.findItemMemoryStates(learnerId, allItemIds);

  return modules.map((module) => {
    const objectiveScores = module.objectives.map((objective) => ({
      subWeight: objective.subWeight,
      score: mean(
        objective.knowledgeItemIds.map((itemId) =>
          liveRetrievability(states.get(itemId) ?? null, now),
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
    const elapsedDays =
      (now.getTime() - published.lastPublishedAt.getTime()) / (1000 * 60 * 60 * 24);
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
