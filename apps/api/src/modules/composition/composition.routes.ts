import { Router, type Router as RouterType } from 'express';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getNextSession } from './composition.controller.js';

export const compositionRouter: RouterType = Router();

compositionRouter.use(requireLearner);
compositionRouter.get('/next', getNextSession);
