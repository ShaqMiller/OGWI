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
