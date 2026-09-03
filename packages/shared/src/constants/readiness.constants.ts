/**
 * Readiness (Doc 2 B2), simplified: no exam/mock system exists yet, so the
 * spec's exam-condition calibration (ratio = achieved score / projection)
 * never has evidence to work with. mu is a pure 14-day-forward projection
 * with no calibration adjustment; sigma is a simplified coverage-only
 * heuristic rather than the full multi-factor formula. Numbers below are
 * starting points, not researched/tuned.
 */
export const READINESS_PROJECTION_DAYS = 14;

/** sigma floor/base for the simplified coverage-only uncertainty heuristic. */
export const READINESS_SIGMA_FLOOR = 0.05;
export const READINESS_SIGMA_BASE = 0.35;

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

export const READINESS_CONFIG_VERSION = 'readiness-simple-2';
