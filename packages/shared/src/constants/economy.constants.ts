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

export const LITRE_CONFIG_VERSION = 'points-v1-simple';
