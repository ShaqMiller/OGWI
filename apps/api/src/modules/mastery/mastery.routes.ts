import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getQualificationMastery, publishQualificationMastery } from './mastery.controller.js';

export const masteryRouter: RouterType = Router();

masteryRouter.use(requireLearner, learnerClock);
masteryRouter.get('/:qualificationSlug', getQualificationMastery);
// A publish point (Doc 2 C4): session end or practice-run end.
masteryRouter.post('/:qualificationSlug/publish', publishQualificationMastery);
