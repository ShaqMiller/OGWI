import type { PublishTrigger, SessionPublishResult } from '@ogwi/shared';
import * as masteryService from '../mastery/mastery.service.js';
import * as readinessService from '../readiness/readiness.service.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 *
 * A publish point (Doc 2 C4): session end, practice-run end or exam submit.
 * "Session end / Practice-run end recomputes published mastery ... odds +
 * certainty + next action, forecast" - so both owners publish together here,
 * and nothing else publishes on a learner's behalf. The daily rollover is the
 * one exception: each module materialises its own lazily on read.
 *
 * Mastery first, then readiness, though neither reads the other: readiness
 * works from live memory state only, never published mastery (invariant 5).
 */
export async function publishSession(
  learnerId: string,
  qualificationId: string,
  trigger: PublishTrigger = 'session',
): Promise<SessionPublishResult> {
  const mastery = await masteryService.publishQualificationMastery(learnerId, qualificationId);
  const readiness = await readinessService.publishReadiness(learnerId, qualificationId, trigger);

  return { mastery, readiness };
}
