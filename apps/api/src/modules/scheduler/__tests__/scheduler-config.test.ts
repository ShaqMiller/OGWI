import { SCHEDULER_CONFIG } from '@ogwi/shared';
import { FSRSVersion, generatorParameters } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { fsrsScheduler } from '../fsrs.util.js';

/**
 * Doc 2 B4: FSRS "adopted unmodified, with the release version pinned in
 * configuration". The client's check-in script asks which release is pinned
 * and expects to see it named in the scheduler config (§4).
 *
 * These fail on a silent drift in either direction: a dependency upgrade the
 * config doesn't record, or a config the running scheduler doesn't honour.
 */
describe('scheduler configuration', () => {
  it('names the ts-fsrs build that is actually installed', () => {
    // An upgrade must be a deliberate config change with a new ID, never a
    // lockfile bump that quietly changes every learner's schedule.
    expect(FSRSVersion).toBe(SCHEDULER_CONFIG.libraryBuild);
  });

  it('keeps the named version and algorithm consistent with that build', () => {
    expect(SCHEDULER_CONFIG.libraryBuild).toContain(`v${SCHEDULER_CONFIG.libraryVersion}`);
    expect(SCHEDULER_CONFIG.libraryBuild).toContain(SCHEDULER_CONFIG.algorithm);
  });

  it('runs the scheduler with exactly the configured options', () => {
    expect(fsrsScheduler.parameters.request_retention).toBe(SCHEDULER_CONFIG.requestRetention);
    expect(fsrsScheduler.parameters.enable_fuzz).toBe(SCHEDULER_CONFIG.enableFuzz);
    expect(fsrsScheduler.parameters.enable_short_term).toBe(SCHEDULER_CONFIG.enableShortTerm);
  });

  it('uses the published default weights, unmodified', () => {
    expect(fsrsScheduler.parameters.w).toEqual(generatorParameters().w);
  });
});
