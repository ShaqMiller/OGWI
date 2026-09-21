import {
  READINESS_NEXT_ACTION_BAND_STEP_VALUE,
  type CertaintyBand,
  type NextAction,
} from '@ogwi/shared';
import {
  fromCard,
  fsrsScheduler,
  gradeToRating,
  toCardInput,
  type PersistedCardFields,
} from '../scheduler/fsrs.util.js';

/**
 * The next action (Doc 2 B2): "Simulate the odds-delta of three candidates -
 * (a) refresh the largest decayed pool; (b) a session on the Biggest
 * Opportunity; (c) a mini-mock when exam evidence is missing or stale
 * (certainty-band gains count as improvement). Highest wins; ties prefer (c)
 * then (a); output one plain line."
 *
 * The pieces here are pure; readiness.service runs the simulations.
 */

export const CERTAINTY_BAND_RANK: Record<CertaintyBand, number> = { early: 0, fair: 1, solid: 2 };

/** Ties prefer the mini-mock, then the refresh, then the Biggest Opportunity. */
const TIE_ORDER: NextAction['kind'][] = ['mini_mock', 'refresh', 'biggest_opportunity'];

/**
 * A candidate, scored. "Certainty-band gains count as improvement" needs the
 * band and the odds in one unit; the spec doesn't give one, so each band step
 * is worth READINESS_NEXT_ACTION_BAND_STEP_VALUE of odds (a default).
 */
export function scoreCandidate(
  kind: NextAction['kind'],
  line: string,
  oddsDelta: number,
  bandSteps: number,
): NextAction {
  return {
    kind,
    line,
    oddsDelta,
    bandSteps,
    score: oddsDelta + bandSteps * READINESS_NEXT_ACTION_BAND_STEP_VALUE,
  };
}

/** The winner, or null when nothing would improve the odds or the certainty. */
export function chooseNextAction(candidates: NextAction[]): NextAction | null {
  const EPSILON = 1e-9;
  let best: NextAction | null = null;

  for (const candidate of candidates) {
    if (candidate.score <= EPSILON) continue;
    if (
      best === null ||
      candidate.score > best.score + EPSILON ||
      (Math.abs(candidate.score - best.score) <= EPSILON &&
        TIE_ORDER.indexOf(candidate.kind) < TIE_ORDER.indexOf(best.kind))
    ) {
      best = candidate;
    }
  }

  return best;
}

/**
 * Memory states as if each of `itemIds` were answered correctly at `now` -
 * the scheduler's own FSRS step, so the simulation uses the same model the
 * real answer would.
 */
export function withCorrectAnswers(
  states: Map<string, PersistedCardFields>,
  everCorrect: Set<string>,
  itemIds: string[],
  now: Date,
): { states: Map<string, PersistedCardFields>; everCorrect: Set<string> } {
  const nextStates = new Map(states);
  const nextEverCorrect = new Set(everCorrect);

  for (const itemId of itemIds) {
    const card = toCardInput(nextStates.get(itemId) ?? null, now);
    nextStates.set(itemId, fromCard(fsrsScheduler.next(card, now, gradeToRating('good')).card));
    nextEverCorrect.add(itemId);
  }

  return { states: nextStates, everCorrect: nextEverCorrect };
}
