import { Router, type Router as RouterType } from 'express';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getQualificationMastery } from './mastery.controller.js';

export const masteryRouter: RouterType = Router();

masteryRouter.use(requireLearner);
masteryRouter.get('/:qualificationSlug', getQualificationMastery);
