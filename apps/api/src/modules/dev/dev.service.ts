import {
  DEMO_LEARNER_PREFIX,
  type DevClock,
  type ResetDemoLearnerResponse,
} from '@ogwi/shared';
import { env } from '../../config/env.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';
import * as clock from '../../lib/clock.js';
import * as devRepository from './dev.repository.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 *
 * The test clock: lets a demo learner's time run ahead of real time so
 * day-scale rules can be demonstrated live. Dev and staging only - the routes
 * are not mounted unless TEST_CLOCK_ENABLED is on, env.ts refuses that flag in
 * production, and every function here checks both conditions again itself.
 */

export function isDemoLearner(learnerId: string): boolean {
  return learnerId.startsWith(DEMO_LEARNER_PREFIX);
}

function assertTestClockAvailable(learnerId: string): void {
  if (!env.TEST_CLOCK_ENABLED) throw new NotFoundError('The test clock is not enabled');

  if (!isDemoLearner(learnerId)) {
    throw new ForbiddenError(
      `Only demo learners (ids starting "${DEMO_LEARNER_PREFIX}") can use the test clock`,
      { learnerId },
    );
  }
}

/**
 * The offset to apply to this learner's requests. 0 - and no query at all -
 * unless the clock is enabled and this is a demo learner, so real learners pay
 * nothing for the feature existing.
 */
export async function getOffsetMs(learnerId: string): Promise<number> {
  if (!env.TEST_CLOCK_ENABLED || !isDemoLearner(learnerId)) return 0;

  return (await devRepository.findOffsetSeconds(learnerId)) * 1000;
}

export async function getClock(learnerId: string): Promise<DevClock> {
  assertTestClockAvailable(learnerId);

  const offsetSeconds = await devRepository.findOffsetSeconds(learnerId);
  // The request already runs at this learner's offset (middleware/learnerClock).
  return { learnerId, offsetSeconds, now: clock.now() };
}

export async function advanceClock(learnerId: string, seconds: number): Promise<DevClock> {
  assertTestClockAvailable(learnerId);

  const offsetSeconds = await devRepository.addOffsetSeconds(learnerId, seconds);
  // clock.now() still carries the offset this request started with, so add
  // only the jump just made.
  return { learnerId, offsetSeconds, now: new Date(clock.now().getTime() + seconds * 1000) };
}

export async function resetDemoLearner(learnerId: string): Promise<ResetDemoLearnerResponse> {
  assertTestClockAvailable(learnerId);

  const deleted = await devRepository.deleteLearnerData(learnerId);
  return { learnerId, deleted };
}
