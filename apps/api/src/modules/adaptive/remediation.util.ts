import { REMEDIATION_EXIT_CORRECT_COUNT } from '@ogwi/shared';
import type { DerivedRemediationState, ReviewLite } from './adaptive.types.js';

/**
 * Derives remediation status entirely from an item's ReviewEvent history -
 * no separate mutable "remediation entry" table exists, matching the
 * append-only philosophy already used for the flight log (Doc 2 invariant
 * 2: "ordinary reads append nothing").
 *
 * Rule (Doc 2 B3, trimmed to what's buildable without answer-format-aware
 * quiz-taking, which doesn't exist yet): any Again enters remediation and
 * resets progress. Two Good answers on two different calendar days exit it
 * - and, when the caller supplied a renderingId on both (grading always
 * accepts one optionally), those two renderings must differ too. If either
 * side didn't supply a renderingId, that half of the check is skipped
 * rather than blocking exit forever on missing data.
 *
 * Calendar day is computed in UTC here as a scaffold simplification - the
 * spec's day-counting rules (local calendar day) belong with real
 * timezone-aware learner state, which doesn't exist yet either.
 *
 * `events` must be sorted ascending by reviewedAt.
 */
export function deriveRemediationState(events: ReviewLite[]): DerivedRemediationState {
  let enteredAt: Date | null = null;
  let exitedAt: Date | null = null;
  let qualifying: { renderingId: string | null; day: string }[] = [];

  for (const event of events) {
    if (event.grade === 'AGAIN') {
      enteredAt = event.reviewedAt;
      exitedAt = null;
      qualifying = [];
      continue;
    }

    // A Good review outside of remediation, or after this episode already
    // resolved, carries no signal for this derivation.
    if (enteredAt === null || exitedAt !== null) continue;

    const day = event.reviewedAt.toISOString().slice(0, 10);
    const sameDayAlready = qualifying.some((q) => q.day === day);
    if (sameDayAlready) continue;

    const renderingConflict =
      event.renderingId !== null &&
      qualifying.some((q) => q.renderingId !== null && q.renderingId === event.renderingId);
    if (renderingConflict) continue;

    qualifying.push({ renderingId: event.renderingId, day });
    if (qualifying.length >= REMEDIATION_EXIT_CORRECT_COUNT) {
      exitedAt = event.reviewedAt;
    }
  }

  return { inRemediation: enteredAt !== null && exitedAt === null, enteredAt, exitedAt };
}
