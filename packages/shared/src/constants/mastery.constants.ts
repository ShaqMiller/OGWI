/**
 * Mastery publishing (Doc 2 B1, C4). Displayed mastery only changes at a
 * publish point - session end, practice-run end, exam submit, or the daily
 * rollover - never mid-activity.
 */

/**
 * The daily rollover never fires within this many minutes of the learner's
 * last answer, so it can't land mid-activity. Doc 2 C3 lists rollover timing
 * as MasteryConfig-tunable; this is a starting value, not a researched one.
 */
export const MASTERY_ROLLOVER_IDLE_MINUTES = 30;
