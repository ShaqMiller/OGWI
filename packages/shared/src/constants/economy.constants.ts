/**
 * Deliberately simple points pricing (Doc 2 B8's fuller "litre economy",
 * trimmed to three tiers by design - no combo bonuses, hard-question
 * multipliers, or session caps yet). Confirm the actual numbers with the
 * client; these are a reasonable industry-standard starting point:
 * spaced-repetition apps generally reward reviewing something right when
 * it's about to be forgotten far more than grinding material you already
 * know, which is what keeps the economy from being farmable.
 */
export const POINTS_FIRST_CORRECT = 5;
export const POINTS_DUE_CORRECT = 7;
export const POINTS_NOT_DUE_CORRECT = 1;
export const POINTS_INCORRECT = 0;

/**
 * Completion premiums for exam-format runs (Doc 2 B8). These are what make a
 * mock "structurally the largest payment in the product" - a full paper's
 * per-question litres plus one of these lands the ~150-200L the spec expects.
 *
 * All three rates are priced here even though only SIMULATION runs can be
 * produced today, so the table matches the spec and is unit-tested. The other
 * two become live for free when those run kinds land, rather than needing the
 * economy reopened - this codebase has twice had parked plumbing forgotten.
 *
 * Paid as an ASSESSMENT litre event, NOT a BONUS: Doc 2 B8 is explicit that
 * there are "no bonuses of any kind in exam mode".
 */
export const PREMIUM_EXAM_SIMULATION = 50;
export const PREMIUM_MINI_MOCK = 20;
export const PREMIUM_CUSTOM_EXAM = 10;

/**
 * The premium pays only when at least this share of questions were answered.
 * Below it, grading still pays the per-question litres for what was answered -
 * only the completion bonus is withheld, because the run wasn't completed.
 */
export const PREMIUM_MIN_ANSWERED = 0.7;

export const LITRE_CONFIG_VERSION = 'points-v1-simple';
