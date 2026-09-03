import {
  POINTS_DUE_CORRECT,
  POINTS_FIRST_CORRECT,
  POINTS_INCORRECT,
  POINTS_NOT_DUE_CORRECT,
  type EconomyBalance,
  type EconomyEvent,
  type ReviewGradeInput,
} from '@ogwi/shared';
import * as economyRepository from './economy.repository.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 */

/**
 * Pure pricing rule, easy to retune once the client has an opinion:
 *   - wrong answer: 0, always (litres never subtract)
 *   - first time this item has ever been answered correctly: top-ish rate,
 *     rewards genuinely new knowledge
 *   - correct while the item was "due" (about to be forgotten): the best
 *     rate - reviewing at the right moment is the highest-value action in
 *     spaced repetition
 *   - correct while not due yet (reviewing something already solid): a
 *     small trickle, so re-grinding easy material can't farm points
 */
export function priceReviewGrade(params: {
  hadPriorState: boolean;
  wasDue: boolean;
  grade: ReviewGradeInput;
}): number {
  if (params.grade === 'again') return POINTS_INCORRECT;
  if (!params.hadPriorState) return POINTS_FIRST_CORRECT;
  return params.wasDue ? POINTS_DUE_CORRECT : POINTS_NOT_DUE_CORRECT;
}
export async function getBalance(
  learnerId: string,
  qualificationId: string,
): Promise<EconomyBalance> {
  const totalPoints = await economyRepository.sumPointsForQualification(learnerId, qualificationId);
  return { totalPoints };
}

export async function getRecentEvents(
  learnerId: string,
  qualificationId: string,
  limit: number,
): Promise<EconomyEvent[]> {
  const rows = await economyRepository.findRecentEvents(learnerId, qualificationId, limit);
  return rows.map((row) => ({
    amount: row.amount,
    source: row.source,
    knowledgeItemId: row.knowledgeItemId,
    effectiveAt: row.effectiveAt,
  }));
}
