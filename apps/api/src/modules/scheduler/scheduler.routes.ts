import { Router, type Router as RouterType } from 'express';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getDueItems, gradeReview } from './scheduler.controller.js';

export const schedulerRouter: RouterType = Router();

schedulerRouter.use(requireLearner);
schedulerRouter.post('/reviews', gradeReview);
schedulerRouter.get('/due', getDueItems);
