import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { advanceClock, getClock, resetDemoLearner } from './dev.controller.js';

export const devRouter: RouterType = Router();

devRouter.use(requireLearner, learnerClock);

/**
 * Dev and staging only. app.ts mounts this router only when TEST_CLOCK_ENABLED
 * is on, so in any other environment these routes don't exist at all.
 */
devRouter.get('/clock', getClock);
devRouter.post('/clock/advance', advanceClock);
devRouter.post('/demo-learner/reset', resetDemoLearner);
