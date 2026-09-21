import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getQualificationMastery } from './mastery.controller.js';

export const masteryRouter: RouterType = Router();

masteryRouter.use(requireLearner, learnerClock);
masteryRouter.get('/:qualificationSlug', getQualificationMastery);
// Publishing happens at POST /api/publishing/:slug, alongside the odds of passing.
