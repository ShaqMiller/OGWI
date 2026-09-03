import { Router, type Router as RouterType } from 'express';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getGapQueue, getWrongAnswerPool } from './adaptive.controller.js';

export const adaptiveRouter: RouterType = Router();

adaptiveRouter.use(requireLearner);
adaptiveRouter.get('/wrong-answer-pool', getWrongAnswerPool);
adaptiveRouter.get('/gap-queue', getGapQueue);
