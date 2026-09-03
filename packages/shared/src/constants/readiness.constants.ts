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

/** Certainty band thresholds, on weighted coverage alone (see the module's note on dropping the exam-run requirement). */
export const READINESS_SOLID_COVERAGE_THRESHOLD = 0.7;
export const READINESS_FAIR_COVERAGE_THRESHOLD = 0.4;

/** Pace (forecast) window. */
export const PACE_WINDOW_DAYS = 28;
export const PACE_HALF_LIFE_DAYS = 14;

export const READINESS_CONFIG_VERSION = 'readiness-simple-1';
