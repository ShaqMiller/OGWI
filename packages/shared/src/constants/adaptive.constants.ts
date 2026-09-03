/**
 * Doc 2 B3 (the adaptive engine / "repair shop"). Kept as plain constants
 * rather than a ConfigDocument row for the same reason as the scheduler's
 * config version - governance-registry wiring is separable from making the
 * feature work.
 */

/** Exit rule: two correct answers, on two different calendar days. */
export const REMEDIATION_EXIT_CORRECT_COUNT = 2;

/** A "Fixing gaps" batch is ready once a module has this many items in remediation... */
export const GAP_QUIZ_MIN_ITEMS = 5;

/** ...or once the oldest unresolved signal is this many days old, whichever comes first. */
export const GAP_QUIZ_MAX_WAIT_DAYS = 7;

/** How far out a freshly-triggered batch is dated ("Ready Thursday" style framing). */
export const GAP_QUIZ_READY_LEAD_DAYS = 2;

/** The wrong-answer pool includes items that exited remediation within this window. */
export const WRONG_ANSWER_POOL_RETEST_WINDOW_DAYS = 30;
