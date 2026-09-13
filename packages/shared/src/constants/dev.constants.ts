/**
 * The test clock (dev and staging only - see apps/api/src/lib/clock.ts).
 *
 * Only learners whose id starts with DEMO_LEARNER_PREFIX can have their clock
 * moved. That keeps real usage - dev-learner-1 included - on real time, so a
 * demo can never stamp someone's actual history into the future.
 */
export const DEMO_LEARNER_PREFIX = 'demo-';

/** The learner the /dev page switches to. */
export const DEMO_LEARNER_ID = 'demo-learner-1';

/** Largest single jump. Generous for demos, small enough that a typo can't fling a learner decades ahead. */
export const MAX_CLOCK_ADVANCE_SECONDS = 60 * 24 * 60 * 60;
