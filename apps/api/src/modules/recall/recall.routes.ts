import { Router, type Router as RouterType } from 'express';
import { getTopicKeyPoints, scoreText } from './recall.controller.js';

export const recallRouter: RouterType = Router();

// Same "browsing is pre-auth" precedent as content-graph - nothing here is
// persisted per-learner, so there's nothing to gate behind requireLearner.
recallRouter.get('/topics/:topicId/key-points', getTopicKeyPoints);
recallRouter.post('/topics/:topicId/score', scoreText);
