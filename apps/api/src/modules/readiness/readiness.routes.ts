import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getReadiness } from './readiness.controller.js';

export const readinessRouter: RouterType = Router();

readinessRouter.use(requireLearner, learnerClock);
readinessRouter.get('/:qualificationSlug', getReadiness);
