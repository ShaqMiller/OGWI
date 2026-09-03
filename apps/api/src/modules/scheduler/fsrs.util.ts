import { DESIRED_RETENTION } from '@ogwi/shared';
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type CardInput,
  type Grade,
} from 'ts-fsrs';

/**
 * The one FSRS instance for the whole module, built from the library's
 * published default parameters (Doc 2 B4: "launch on FSRS's published
 * default parameters"). Per-learner parameter optimisation is explicitly
 * deferred in the handover, not built here.
 */
export const fsrsScheduler = fsrs(generatorParameters({ request_retention: DESIRED_RETENTION }));

const DB_TO_FSRS_STATE = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
} as const;

const FSRS_TO_DB_STATE: Record<State, DbSchedulerState> = {
  [State.New]: 'NEW',
  [State.Learning]: 'LEARNING',
  [State.Review]: 'REVIEW',
  [State.Relearning]: 'RELEARNING',
};

export type DbSchedulerState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';

/** Exactly the columns persisted on ItemMemoryState, independent of Prisma's types. */
export interface PersistedCardFields {
  difficulty: number;
  stability: number;
  due: Date;
  lastReviewedAt: Date | null;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: DbSchedulerState;
}

/**
 * Rebuilds a ts-fsrs Card/CardInput from what's persisted, or a fresh card
 * if the learner has never seen this item before. elapsed_days is a
 * deprecated ts-fsrs field FSRS itself recomputes from `now` minus
 * last_review, so 0 is always a safe placeholder here.
 */
export function toCardInput(persisted: PersistedCardFields | null, now: Date): CardInput | Card {
  if (!persisted) {
    return createEmptyCard(now);
  }

  return {
    due: persisted.due,
    stability: persisted.stability,
    difficulty: persisted.difficulty,
    elapsed_days: 0,
    scheduled_days: persisted.scheduledDays,
    learning_steps: persisted.learningSteps,
    reps: persisted.reps,
    lapses: persisted.lapses,
    state: DB_TO_FSRS_STATE[persisted.state],
    ...(persisted.lastReviewedAt ? { last_review: persisted.lastReviewedAt } : {}),
  };
}

export function fromCard(card: Card): PersistedCardFields {
  return {
    difficulty: card.difficulty,
    stability: card.stability,
    due: card.due,
    lastReviewedAt: card.last_review ?? null,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: FSRS_TO_DB_STATE[card.state],
  };
}

export function gradeToRating(grade: 'again' | 'good'): Grade {
  return grade === 'good' ? Rating.Good : Rating.Again;
}

/** Live retrievability right now (0-1) - never stored, always recomputed. */
export function liveRetrievability(persisted: PersistedCardFields | null, now: Date): number {
  if (!persisted) {
    // "Never-retrieved items score exactly 0" (Doc 2 B1).
    return 0;
  }

  return fsrsScheduler.get_retrievability(toCardInput(persisted, now), now, false);
}
