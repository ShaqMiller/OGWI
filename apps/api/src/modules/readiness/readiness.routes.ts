import { Router, type Router as RouterType } from 'express';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getReadiness } from './readiness.controller.js';

export const readinessRouter: RouterType = Router();

readinessRouter.use(requireLearner);
readinessRouter.get('/:qualificationSlug', getReadiness);
