import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getWeeklyActivity } from './progress.controller.js';

export const progressRouter: RouterType = Router();

progressRouter.use(requireLearner, learnerClock);

// Doc 2 A10 part 2: "This week so far", with previous weeks skimmable.
progressRouter.get('/weekly', getWeeklyActivity);
