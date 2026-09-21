/**
 * Readiness (Doc 2 B2). mu is a 14-day-forward projection, calibrated against
 * the learner's exam-format runs; sigma combines the spec's four named
 * ingredients. Numbers below are starting points, not researched/tuned.
 */
export const READINESS_PROJECTION_DAYS = 14;

/**
 * sigma (the uncertainty behind the odds) - see readiness/sigma.util.ts. The
 * floor stops precision ever being faked; BASE scales the untouched-coverage
 * ingredient; EVIDENCE_BASE is the evidence ingredient with no exam runs at
 * all, shrinking as recent runs accumulate. The spec gives no formula, so all
 * three are defaults.
 */
export const READINESS_SIGMA_FLOOR = 0.05;
export const READINESS_SIGMA_BASE = 0.35;
export const READINESS_SIGMA_EVIDENCE_BASE = 0.08;

/** Below this odds, the raw number is withheld for the "climb" framing. */
export const READINESS_DISPLAY_WITHHOLD_THRESHOLD = 0.2;

/** The one-time "you'd likely pass" celebration threshold. */
export const READINESS_CELEBRATION_THRESHOLD = 0.8;

/**
 * Certainty band thresholds. Doc 2 B2: "Solid = weighted coverage >=70% and
 * >=2 exam-format runs in 30 days · Fair = >=40% and >=1 run in 45 days ·
 * Early = anything less".
 *
 * The run half of that rule used to be dropped, because no exam system
 * existed and gating on runs that could never happen pinned the band at
 * "early" forever. Exam Simulation now produces them, so both halves apply.
 */
export const READINESS_SOLID_COVERAGE_THRESHOLD = 0.7;
export const READINESS_FAIR_COVERAGE_THRESHOLD = 0.4;

export const READINESS_SOLID_RUN_COUNT = 2;
export const READINESS_SOLID_RUN_WINDOW_DAYS = 30;
export const READINESS_FAIR_RUN_COUNT = 1;
export const READINESS_FAIR_RUN_WINDOW_DAYS = 45;

/**
 * Runs shorter than this don't count as evidence. Set to 1 because the demo
 * content can only produce an 8-question paper and anything higher would make
 * "solid" unreachable - but it exists so that raising the bar (once real
 * qualification content lands and two trivially short runs shouldn't buy a
 * confident band) is a config change rather than a code change.
 */
export const READINESS_MIN_RUN_QUESTION_COUNT = 1;

/** Pace (forecast) window. */
export const PACE_WINDOW_DAYS = 28;
export const PACE_HALF_LIFE_DAYS = 14;

/**
 * Exam-condition calibration (Doc 2 B2): the projection is multiplied by the
 * recency-weighted mean of (achieved score / projection at that moment) across
 * exam runs, clamped to [MIN_RATIO, MAX_RATIO]. The clamp values are the spec's.
 */
export const READINESS_CALIBRATION_MIN_RATIO = 0.7;
export const READINESS_CALIBRATION_MAX_RATIO = 1.1;

/**
 * "Recency-weighted" has no weighting in the spec. A run's weight halves every
 * this-many days - 30, to match the window a "solid" certainty band looks at.
 * A default, not a researched value.
 */
export const READINESS_CALIBRATION_HALF_LIFE_DAYS = 30;

/**
 * Runs whose projection was below this don't calibrate: dividing by a
 * near-zero projection makes the ratio meaningless (one right answer over a
 * projection of 0.01 is a ratio of 100). They still count as exam evidence for
 * the certainty band. Not in the spec - a default to keep the maths honest.
 */
export const READINESS_CALIBRATION_MIN_PROJECTION = 0.05;

/**
 * The first-score unlock checklist (Doc 2 B2): complete a topic, answer
 * questions across two modules, complete one mini-mock. No odds are published
 * until all three are done. The module requirement is capped at the
 * qualification's module count - see unlock-checklist.util.ts.
 */
export const READINESS_UNLOCK_TOPICS_REQUIRED = 1;
export const READINESS_UNLOCK_MODULES_REQUIRED = 2;
export const READINESS_UNLOCK_EXAM_RUNS_REQUIRED = 1;

export const READINESS_CONFIG_VERSION = 'readiness-calibrated-3';
