import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors/index.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      learnerId?: string;
    }
  }
}

/**
 * TODO(auth): this is a stub. It trusts a dev header instead of validating a
 * real session/token. Replace with real auth before any of this touches
 * production data - do not pick a provider without the team's sign-off, per
 * the handover's "auth is deliberately unspecified" note.
 */
export function requireLearner(req: Request, _res: Response, next: NextFunction): void {
  const learnerId = req.header('x-dev-learner-id');

  if (!learnerId) {
    throw new UnauthorizedError('Missing x-dev-learner-id header (auth is not yet implemented)');
  }

  req.learnerId = learnerId;
  next();
}
