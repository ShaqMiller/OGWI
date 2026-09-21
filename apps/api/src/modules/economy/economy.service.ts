import {
  LITRE_CONFIG_VERSION,
  PREMIUM_CUSTOM_EXAM,
  PREMIUM_EXAM_SIMULATION,
  PREMIUM_MINI_MOCK,
  PREMIUM_MIN_ANSWERED,
  POINTS_DUE_CORRECT,
  POINTS_FIRST_CORRECT,
  POINTS_INCORRECT,
  POINTS_NOT_DUE_CORRECT,
  type EconomyBalance,
  type EconomyEvent,
  type ReviewGradeInput,
} from '@ogwi/shared';
import type { ExamRunKind } from '@ogwi/shared';
import * as clock from '../../lib/clock.js';
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

/**
 * The completion premium for a finished exam-format run (Doc 2 B8).
 *
 * Pure. Gated on how much of the paper was actually answered: below
 * PREMIUM_MIN_ANSWERED the per-question litres are still paid for whatever was
 * answered, but the completion premium is not - the run wasn't completed.
 *
 * CUSTOM is priced but unreachable until the test builder exists.
 */
export function priceExamPremium(params: {
  kind: ExamRunKind;
  answeredCount: number;
  questionCount: number;
}): number {
  if (params.questionCount <= 0) return 0;
  if (params.answeredCount / params.questionCount < PREMIUM_MIN_ANSWERED) return 0;

  switch (params.kind) {
    case 'SIMULATION':
      return PREMIUM_EXAM_SIMULATION;
    case 'MINI_MOCK':
      return PREMIUM_MINI_MOCK;
    case 'CUSTOM':
      return PREMIUM_CUSTOM_EXAM;
    default: {
      const unhandled: never = params.kind;
      return unhandled;
    }
  }
}

/** Records a run's completion premium. Idempotent via the supplied key. */
export async function awardExamPremium(params: {
  learnerId: string;
  qualificationId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<boolean> {
  if (params.amount <= 0) return false;

  return economyRepository.recordExamPremium({
    learnerId: params.learnerId,
    qualificationId: params.qualificationId,
    amount: params.amount,
    idempotencyKey: params.idempotencyKey,
    litreConfigVersion: LITRE_CONFIG_VERSION,
    effectiveAt: clock.now(),
  });
}

export async function sumLitresForKeys(idempotencyKeys: string[]): Promise<number> {
  return economyRepository.sumAmountsForKeys(idempotencyKeys);
}
