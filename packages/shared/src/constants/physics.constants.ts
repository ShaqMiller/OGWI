/**
 * Flight physics (Doc 2 B9): 1 litre = 1 foot. Grounded litres accumulate
 * leak-free; once airborne, altitude leaks continuously until touchdown at
 * 0. These are the spec's own published defaults - reasonable as a
 * starting point, not researched/tuned by us.
 */
export const LIFTOFF_THRESHOLD_FT = 100;
export const TOUCHDOWN_FILL_FT = 0;
export const ALTITUDE_CAP_FT = 1000;

/** Below this altitude, leak is linear (in feet/day). */
export const PROPORTIONAL_LEAK_THRESHOLD_FT = 200;
export const LINEAR_LEAK_PER_DAY_FT = 90;

/** At/above the threshold, leak is proportional (fraction of current fill/day). */
export const PROPORTIONAL_LEAK_RATE_PER_DAY = 0.5;

export const PHYSICS_CONFIG_VERSION = 'physics-default-1';
