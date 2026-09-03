import {
  DESIRED_RETENTION,
  SCHEDULER_CONFIG_VERSION,
  type ReviewGradeInput,
  type SubmitAnswerResponse,
  type SubmittedAnswer,
} from '@ogwi/shared';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as economyService from '../economy/economy.service.js';
import * as flightService from '../flight/flight.service.js';
import * as schedulerRepository from './scheduler.repository.js';
import { fromCard, fsrsScheduler, gradeToRating, liveRetrievability, toCardInput } from './fsrs.util.js';
import type { DueItem, GradedItemState } from './scheduler.types.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 */

/**
 * Marks a submitted answer and records the result. The only way a review is
 * written from outside the API: gradeReview below takes a grade directly and
 * is no longer reachable over HTTP, because accepting a client-supplied
 * verdict let anyone forge mastery, litres, flight altitude and pass odds.
 *
 * checkAnswer runs FIRST and throws on a rendering mismatch or an
 * inapplicable answer. That ordering is load-bearing: gradeReview performs
 * several writes across four modules without a transaction, so anything that
 * can reject has to reject before the first one.
 */
export async function submitAnswer(
  learnerId: string,
  knowledgeItemId: string,
  renderingId: string,
  answer: SubmittedAnswer,
): Promise<SubmitAnswerResponse> {
  const verdict = await contentGraphService.checkAnswer(knowledgeItemId, renderingId, answer);

  const grade: ReviewGradeInput = verdict.correct ? 'good' : 'again';
  const memoryState = await gradeReview(learnerId, knowledgeItemId, grade, renderingId);

  return {
    correct: verdict.correct,
    grade,
    correctOptionIndex: verdict.correctOptionIndex,
    memoryState,
  };
}

/**
 * Everything gradeReview does except pumping the flight, returning the points
 * it awarded so the caller can pump once for a batch.
 *
 * This exists for exam submission. Pumping per item there would be
 * quadratic - flightService.pump calls getFlightState, which replays the
 * flight's entire pump history - so a 30-question paper would re-read the
 * whole history thirty times. Aggregating is behaviourally equivalent: fill
 * is additive and the award check already scans the whole crossed span.
 *
 * Litres are NOT aggregated: LitreEvent is source-itemised, one row per
 * learning act (Doc 2 B8).
 */
export async function gradeReviewDeferringPump(
  learnerId: string,
  knowledgeItemId: string,
  grade: ReviewGradeInput,
  renderingId: string | null,
): Promise<{ state: GradedItemState; pointsAwarded: number }> {
  const now = new Date();
  const existing = await schedulerRepository.findItemMemoryState(learnerId, knowledgeItemId);

  // Computed from the *pre-grading* state, before FSRS updates it - this is
  // what "due" meant at the moment the learner answered.
  const wasDue = existing !== null && liveRetrievability(existing, now) <= DESIRED_RETENTION;

  const cardInput = toCardInput(existing, now);
  const { card } = fsrsScheduler.next(cardInput, now, gradeToRating(grade));
  const persisted = fromCard(card);

  await schedulerRepository.upsertItemMemoryState(
    learnerId,
    knowledgeItemId,
    persisted,
    SCHEDULER_CONFIG_VERSION,
  );

  await schedulerRepository.recordReviewEvent({
    learnerId,
    knowledgeItemId,
    renderingId,
    grade: grade === 'good' ? 'GOOD' : 'AGAIN',
    resultingDifficulty: persisted.difficulty,
    resultingStability: persisted.stability,
    resultingDue: persisted.due,
    schedulerConfigVersion: SCHEDULER_CONFIG_VERSION,
  });

  const points = economyService.priceReviewGrade({ hadPriorState: existing !== null, wasDue, grade });
  await economyService.awardForReview(learnerId, knowledgeItemId, points);

  return { state: { knowledgeItemId, ...persisted }, pointsAwarded: points };
}

export async function gradeReview(
  learnerId: string,
  knowledgeItemId: string,
  grade: ReviewGradeInput,
  renderingId: string | null,
): Promise<GradedItemState> {
  const { state, pointsAwarded } = await gradeReviewDeferringPump(
    learnerId,
    knowledgeItemId,
    grade,
    renderingId,
  );

  // Litres and flight fill are the same currency (Doc 2 B9 builds on B8's
  // source-itemised litre events) - every earned point pumps the flight.
  if (pointsAwarded > 0) {
    await pumpForKnowledgeItem(learnerId, knowledgeItemId, pointsAwarded);
  }

  return state;
}

/** Resolves an item's qualification and pumps its flight. No-op when unresolvable. */
export async function pumpForKnowledgeItem(
  learnerId: string,
  knowledgeItemId: string,
  points: number,
): Promise<void> {
  if (points <= 0) return;

  const qualificationId =
    await contentGraphService.getQualificationIdForKnowledgeItem(knowledgeItemId);

  if (qualificationId) {
    await flightService.pump(learnerId, qualificationId, points);
  }
}

export async function getDueItems(
  learnerId: string,
  qualificationId: string,
  limit: number,
): Promise<DueItem[]> {
  const now = new Date();
  const { dueStates, newItemIds } = await schedulerRepository.findDueItems(
    learnerId,
    qualificationId,
    limit,
    now,
  );

  return [
    ...dueStates.map((s) => ({ knowledgeItemId: s.knowledgeItemId, due: s.due, isNew: false })),
    ...newItemIds.map((id) => ({ knowledgeItemId: id, due: null, isNew: true })),
  ];
}
