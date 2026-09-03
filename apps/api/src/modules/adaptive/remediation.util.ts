import { REMEDIATION_EXIT_CORRECT_COUNT } from '@ogwi/shared';
import type { DerivedRemediationState, ReviewLite } from './adaptive.types.js';

/**
 * Derives remediation status entirely from an item's ReviewEvent history -
 * no separate mutable "remediation entry" table exists, matching the
 * append-only philosophy already used for the flight log (Doc 2 invariant
 * 2: "ordinary reads append nothing").
 *
 * Rule (Doc 2 B3): any Again enters remediation and resets progress. Two
 * Good answers on two different calendar days exit it - and, per the spec,
 * "two correct answers, on two different renderings, on two different days".
 *
 * That distinctness requirement assumes the spec's content model, where
 * "each item owns multiple renderings (base question, >=2 variants,
 * format-ladder versions)". The point is that re-recognising the exact same
 * wording twice isn't proof you know the fact.
 *
 * Our content doesn't have variants yet - every item has exactly one BASE
 * rendering. Enforcing distinctness against single-rendering content is
 * unsatisfiable: both Goods necessarily carry the same renderingId, the
 * second is rejected, `qualifying` never reaches two, and the item stays in
 * remediation forever. So the caller passes `enforceRenderingDistinctness`,
 * set from the item's actual rendering count, and the rule switches itself
 * on once variants are authored. See adaptive.service.getRemediationRows.
 *
 * Calendar day is computed in UTC here as a scaffold simplification - the
 * spec's day-counting rules (local calendar day) belong with real
 * timezone-aware learner state, which doesn't exist yet either.
 *
 * `events` must be sorted ascending by reviewedAt.
 */
export function deriveRemediationState(
  events: ReviewLite[],
  options: { enforceRenderingDistinctness: boolean } = { enforceRenderingDistinctness: false },
): DerivedRemediationState {
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
      options.enforceRenderingDistinctness &&
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
