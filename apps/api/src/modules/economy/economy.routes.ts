import { Router, type Router as RouterType } from 'express';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getBalance, getRecentEvents } from './economy.controller.js';

export const economyRouter: RouterType = Router();

economyRouter.use(requireLearner);
economyRouter.get('/balance', getBalance);
economyRouter.get('/recent', getRecentEvents);
