import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getNextSession } from './composition.controller.js';

export const compositionRouter: RouterType = Router();

compositionRouter.use(requireLearner, learnerClock);
compositionRouter.get('/next', getNextSession);
