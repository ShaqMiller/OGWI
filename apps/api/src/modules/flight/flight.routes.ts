import { Router, type Router as RouterType } from 'express';
import { learnerClock } from '../../middleware/learnerClock.js';
import { requireLearner } from '../../middleware/requireLearner.js';
import { getAwards, getFlightState } from './flight.controller.js';

export const flightRouter: RouterType = Router();

flightRouter.use(requireLearner, learnerClock);
flightRouter.get('/state', getFlightState);
flightRouter.get('/awards', getAwards);
