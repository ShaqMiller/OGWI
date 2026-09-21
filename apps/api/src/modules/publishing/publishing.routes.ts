import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { publishSession } from './publishing.controller.js';

export const publishingRouter: RouterType = Router();

publishingRouter.use(requireLearner, learnerClock);

// Session end or practice-run end (Doc 2 C4): publishes mastery and the odds together.
publishingRouter.post('/:qualificationSlug', publishSession);
