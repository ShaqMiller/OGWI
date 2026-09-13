import { REMEDIATION_EXIT_CORRECT_COUNT } from '@ogwi/shared';
import type { DerivedRemediationState, QualifyingAnswer, ReviewLite } from './adaptive.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  let againCount = 0;
  let qualifying: QualifyingAnswer[] = [];

  for (const event of events) {
    if (event.grade === 'AGAIN') {
      // A miss while already in remediation resets progress but belongs to the
      // same episode; a miss after an exit (or the first ever) starts a new one.
      const continuingEpisode = enteredAt !== null && exitedAt === null;
      againCount = continuingEpisode ? againCount + 1 : 1;
      enteredAt = event.reviewedAt;
      exitedAt = null;
      qualifying = [];
      continue;
    }

    // A Good review outside of remediation, or after this episode already
    // resolved, carries no signal for this derivation.
    if (enteredAt === null || exitedAt !== null) continue;

    const day = utcDay(event.reviewedAt);
    const sameDayAlready = qualifying.some((q) => q.day === day);
    if (sameDayAlready) continue;

    const renderingConflict =
      options.enforceRenderingDistinctness &&
      event.renderingId !== null &&
      qualifying.some((q) => q.renderingId !== null && q.renderingId === event.renderingId);
    if (renderingConflict) continue;

    qualifying.push({ reviewedAt: event.reviewedAt, day, renderingId: event.renderingId });
    if (qualifying.length >= REMEDIATION_EXIT_CORRECT_COUNT) {
      exitedAt = event.reviewedAt;
    }
  }

  const inRemediation = enteredAt !== null && exitedAt === null;
  const lastQualifying = qualifying[qualifying.length - 1];

  return {
    inRemediation,
    enteredAt,
    exitedAt,
    againCount,
    qualifyingAnswers: qualifying,
    correctAnswersNeeded:
      enteredAt === null ? 0 : Math.max(0, REMEDIATION_EXIT_CORRECT_COUNT - qualifying.length),
    // Everything below is what the loop already knew and used to throw away.
    // A correct answer counts at once after a miss; after one has counted, the
    // next can only count from the following UTC day.
    nextQualifyingFrom: !inRemediation
      ? null
      : lastQualifying
        ? startOfNextUtcDay(lastQualifying.day)
        : enteredAt,
    renderingDistinctnessEnforced: options.enforceRenderingDistinctness,
  };
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfNextUtcDay(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + DAY_MS);
}
