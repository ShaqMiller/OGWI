/**
 * A plain version string stamped on scheduler writes (Doc 2 C3's "every
 * event carries its config-version IDs" idea), kept as a constant rather
 * than a row in the ConfigDocument table for now - full config-registry
 * read/write is separable from making the scheduler function correctly.
 */
export const SCHEDULER_CONFIG_VERSION = 'fsrs-default-1';

/**
 * FSRS's requested-retention parameter: the target probability of correct
 * recall at the moment an item is due. 0.90 matches the handover's stated
 * default (Doc 2 B4) and FSRS's own published default.
 */
export const DESIRED_RETENTION = 0.9;

/**
 * What SCHEDULER_CONFIG_VERSION actually resolves to - Doc 2 B4 requires FSRS
 * "adopted unmodified, with the release version pinned in configuration".
 *
 * fsrs.util.ts builds the running scheduler FROM this object, so the stated
 * configuration and the executing one cannot drift apart. Fuzz and short-term
 * scheduling are spelled out rather than inherited from library defaults: a
 * default that changed in a future ts-fsrs release would otherwise alter every
 * learner's schedule without anyone deciding to.
 *
 * The ID is deliberately unchanged from before this object existed - the
 * behaviour did not change, it just became nameable. A test fails if the
 * installed ts-fsrs ever reports a different build, so an upgrade has to be a
 * deliberate config change with a new ID.
 */
export const SCHEDULER_CONFIG = {
  id: SCHEDULER_CONFIG_VERSION,
  library: 'ts-fsrs',
  libraryVersion: '5.4.1',
  /** Exactly as reported by ts-fsrs's own FSRSVersion export. */
  libraryBuild: 'v5.4.1 using FSRS-6.0',
  algorithm: 'FSRS-6.0',
  /** Published default weights, unmodified - per-learner optimisation is deferred. */
  weights: 'published-defaults',
  requestRetention: DESIRED_RETENTION,
  enableFuzz: false,
  enableShortTerm: true,
} as const;
