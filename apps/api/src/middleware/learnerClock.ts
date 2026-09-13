import type { NextFunction, Request, Response } from 'express';
import { runWithOffset } from '../lib/clock.js';
import * as devService from '../modules/dev/dev.service.js';

/**
 * Applies the learner's test-clock offset to the rest of the request. Must run
 * after requireLearner.
 *
 * Resolved once here rather than at every clock read, so a graded answer -
 * which reads the time in the scheduler, economy and flight - costs one lookup,
 * and pure code never has to await the time. For anyone who isn't a demo
 * learner, or with the test clock off, this makes no query and changes nothing.
 *
 * next() is called INSIDE runWithOffset: Express runs the following handlers
 * synchronously from that call, so they and everything they await inherit the
 * offset.
 */
export async function learnerClock(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const offsetMs = await devService.getOffsetMs(req.learnerId as string);

  if (offsetMs === 0) {
    next();
    return;
  }

  runWithOffset(offsetMs, () => next());
}
