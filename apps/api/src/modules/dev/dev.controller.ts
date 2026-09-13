import { advanceClockRequestSchema } from '@ogwi/shared';
import type { Request, Response } from 'express';
import * as devService from './dev.service.js';

/**
 * Translates HTTP <-> domain calls only. No business rules, no Prisma.
 */

export async function getClock(req: Request, res: Response): Promise<void> {
  // requireLearner has already run and guarantees this is set.
  const learnerId = req.learnerId as string;

  res.status(200).json(await devService.getClock(learnerId));
}

export async function advanceClock(req: Request, res: Response): Promise<void> {
  const body = advanceClockRequestSchema.parse(req.body);
  const learnerId = req.learnerId as string;

  res.status(200).json(await devService.advanceClock(learnerId, body.seconds));
}

export async function resetDemoLearner(req: Request, res: Response): Promise<void> {
  const learnerId = req.learnerId as string;

  res.status(200).json(await devService.resetDemoLearner(learnerId));
}
