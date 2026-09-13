import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getBalance, getRecentEvents } from './economy.controller.js';

export const economyRouter: RouterType = Router();

economyRouter.use(requireLearner, learnerClock);
economyRouter.get('/balance', getBalance);
economyRouter.get('/recent', getRecentEvents);
