import { DESIRED_RETENTION, SCHEDULER_CONFIG_VERSION, type ReviewGradeInput } from '@ogwi/shared';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as economyService from '../economy/economy.service.js';
import * as flightService from '../flight/flight.service.js';
import * as schedulerRepository from './scheduler.repository.js';
import { fromCard, fsrsScheduler, gradeToRating, liveRetrievability, toCardInput } from './fsrs.util.js';
import type { DueItem, GradedItemState } from './scheduler.types.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 */

export async function gradeReview(
  learnerId: string,
  knowledgeItemId: string,
  grade: ReviewGradeInput,
  renderingId: string | null,
): Promise<GradedItemState> {
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

  // Litres and flight fill are the same currency (Doc 2 B9 builds on B8's
  // source-itemised litre events) - every earned point pumps the flight.
  if (points > 0) {
    const qualificationId = await contentGraphService.getQualificationIdForKnowledgeItem(
      knowledgeItemId,
    );
    if (qualificationId) {
      await flightService.pump(learnerId, qualificationId, points);
    }
  }

  return { knowledgeItemId, ...persisted };
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
