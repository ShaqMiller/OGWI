import {
  DESIRED_RETENTION,
  LITRE_CONFIG_VERSION,
  SCHEDULER_CONFIG_VERSION,
  type ReviewGradeInput,
  type SubmitAnswerResponse,
  type SubmittedAnswer,
} from '@ogwi/shared';
import { ConflictError, NotFoundError } from '../../errors/index.js';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as economyService from '../economy/economy.service.js';
import * as flightService from '../flight/flight.service.js';
import * as schedulerRepository from './scheduler.repository.js';
import { pumpKey, reviewActKey } from './idempotency.util.js';
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
  attemptId: string,
): Promise<SubmitAnswerResponse> {
  const verdict = await contentGraphService.checkAnswer(knowledgeItemId, renderingId, answer);
  const actKey = reviewActKey(learnerId, attemptId);
  const selectedOptionIndex = answer.kind === 'option_index' ? answer.selectedOptionIndex : null;

  const recorded = await schedulerRepository.findRecordedAnswer(actKey);

  if (recorded) {
    // A reused attemptId carrying a DIFFERENT answer is a client defect, not
    // a retry. Refusing loudly matters: silently returning the first result
    // would swallow every later answer, which is indistinguishable from the
    // cooldown Doc 2 B8 forbids.
    if (recorded.selectedOptionIndex !== selectedOptionIndex) {
      throw new ConflictError('That attempt id was already used for a different answer', {
        attemptId,
      });
    }

    // The pump may have been lost after the write committed, so replay it
    // with the points this act actually paid rather than skipping it.
    await pumpForKnowledgeItem(learnerId, knowledgeItemId, recorded.pointsAwarded, pumpKey(actKey));

    return {
      // Derived from the stored grade, not a fresh check: if the answer key
      // were corrected in between, re-checking would report a verdict that
      // contradicts the memory state actually written.
      correct: recorded.grade === 'GOOD',
      grade: recorded.grade === 'GOOD' ? 'good' : 'again',
      correctOptionIndex: verdict.correctOptionIndex,
      memoryState: await getMemoryState(learnerId, knowledgeItemId),
    };
  }

  const grade: ReviewGradeInput = verdict.correct ? 'good' : 'again';
  const memoryState = await gradeReview(
    learnerId,
    knowledgeItemId,
    grade,
    renderingId,
    actKey,
    selectedOptionIndex,
  );

  return {
    correct: verdict.correct,
    grade,
    correctOptionIndex: verdict.correctOptionIndex,
    memoryState,
  };
}

/** The item's live memory state, for replaying a response. */
async function getMemoryState(
  learnerId: string,
  knowledgeItemId: string,
): Promise<GradedItemState> {
  const existing = await schedulerRepository.findItemMemoryState(learnerId, knowledgeItemId);

  if (!existing) throw new NotFoundError(`No memory state for item "${knowledgeItemId}"`);

  return { knowledgeItemId, ...existing };
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
  idempotencyKey: string,
  selectedOptionIndex: number | null = null,
): Promise<{ state: GradedItemState; pointsAwarded: number; qualificationId: string }> {
  const now = new Date();
  const existing = await schedulerRepository.findItemMemoryState(learnerId, knowledgeItemId);

  // Computed from the *pre-grading* state, before FSRS updates it - this is
  // what "due" meant at the moment the learner answered.
  const wasDue = existing !== null && liveRetrievability(existing, now) <= DESIRED_RETENTION;

  const cardInput = toCardInput(existing, now);
  const { card } = fsrsScheduler.next(cardInput, now, gradeToRating(grade));
  const persisted = fromCard(card);

  const points = economyService.priceReviewGrade({ hadPriorState: existing !== null, wasDue, grade });

  // Resolved before the write so the litre row can carry its qualification -
  // a balance is per qualification, and a payment that couldn't name one would
  // be invisible in it.
  const qualificationId =
    await contentGraphService.getQualificationIdForKnowledgeItem(knowledgeItemId);
  if (!qualificationId) {
    throw new NotFoundError(`Knowledge item "${knowledgeItemId}" does not belong to a qualification`);
  }

  // Everything above is pure or a read; every write happens in here, in one
  // transaction, so a duplicate that loses the claim leaves nothing behind.
  const { written } = await schedulerRepository.recordGradedAnswer({
    idempotencyKey,
    learnerId,
    knowledgeItemId,
    renderingId,
    selectedOptionIndex,
    grade: grade === 'good' ? 'GOOD' : 'AGAIN',
    resulting: persisted,
    schedulerConfigVersion: SCHEDULER_CONFIG_VERSION,
    litre: points > 0 ? { amount: points, litreConfigVersion: LITRE_CONFIG_VERSION, qualificationId } : null,
  });

  if (!written) {
    // Already recorded. Report what that act actually paid, not zero - a
    // caller replaying after a lost pump still needs to complete it.
    const recorded = await schedulerRepository.findRecordedAnswer(idempotencyKey);
    const priorState = await schedulerRepository.findItemMemoryState(learnerId, knowledgeItemId);

    return {
      state: { knowledgeItemId, ...(priorState ?? persisted) },
      pointsAwarded: recorded?.pointsAwarded ?? 0,
      qualificationId,
    };
  }

  return { state: { knowledgeItemId, ...persisted }, pointsAwarded: points, qualificationId };
}

export async function gradeReview(
  learnerId: string,
  knowledgeItemId: string,
  grade: ReviewGradeInput,
  renderingId: string | null,
  idempotencyKey: string,
  selectedOptionIndex: number | null = null,
): Promise<GradedItemState> {
  const { state, pointsAwarded, qualificationId } = await gradeReviewDeferringPump(
    learnerId,
    knowledgeItemId,
    grade,
    renderingId,
    idempotencyKey,
    selectedOptionIndex,
  );

  // Litres and flight fill are the same currency (Doc 2 B9 builds on B8's
  // source-itemised litre events) - every earned point pumps the flight.
  if (pointsAwarded > 0) {
    // The qualification is already resolved, so pump directly rather than
    // looking it up a second time.
    await flightService.pump(learnerId, qualificationId, pointsAwarded, pumpKey(idempotencyKey));
  }

  return state;
}

/** Resolves an item's qualification and pumps its flight. No-op when unresolvable. */
export async function pumpForKnowledgeItem(
  learnerId: string,
  knowledgeItemId: string,
  points: number,
  idempotencyKey: string,
): Promise<void> {
  if (points <= 0) return;

  const qualificationId =
    await contentGraphService.getQualificationIdForKnowledgeItem(knowledgeItemId);

  if (qualificationId) {
    await flightService.pump(learnerId, qualificationId, points, idempotencyKey);
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
