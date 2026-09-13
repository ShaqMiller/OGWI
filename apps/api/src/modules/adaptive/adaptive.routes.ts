import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getGapQueue, getRemediationRecords, getWrongAnswerPool } from './adaptive.controller.js';

export const adaptiveRouter: RouterType = Router();

adaptiveRouter.use(requireLearner, learnerClock);
adaptiveRouter.get('/wrong-answer-pool', getWrongAnswerPool);
adaptiveRouter.get('/gap-queue', getGapQueue);
// The remediation record (Doc 2 B3): source, entry, and progress toward exit per item.
adaptiveRouter.get('/remediation-records', getRemediationRecords);
