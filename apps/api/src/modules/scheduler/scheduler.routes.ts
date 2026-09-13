import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getDueItems, getReviewLog, submitAnswer } from './scheduler.controller.js';

export const schedulerRouter: RouterType = Router();

schedulerRouter.use(requireLearner, learnerClock);

/**
 * POST /answers replaced POST /reviews, which accepted a client-computed
 * grade. The old route is gone rather than deprecated: while it existed,
 * any caller could forge mastery, litres, altitude and pass odds by simply
 * posting `grade: "good"`.
 *
 * NOTE for exam mode (Doc 2 invariant 10: "exam mode contains no aid
 * machinery"): this endpoint reveals the correct answer in its response, so
 * it must NOT be reused as-is for exam runs - that would ship an open-book
 * exam. An exam submission path needs to withhold the key until the run is
 * submitted.
 */
schedulerRouter.post('/answers', submitAnswer);
schedulerRouter.get('/due', getDueItems);
// The prediction-vs-outcome log (Doc 2 B4), newest first.
schedulerRouter.get('/review-log', getReviewLog);
