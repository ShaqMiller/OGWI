// Patches Express so a rejected promise / thrown error inside an `async`
// route handler reaches the error middleware instead of crashing the
// process (Express 4 doesn't do this natively - a real bug found when a
// malformed request took the whole API down). Must be imported before any
// router that uses async handlers.
import 'express-async-errors';
import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { adaptiveRouter } from './modules/adaptive/adaptive.routes.js';
import { compositionRouter } from './modules/composition/composition.routes.js';
import { contentGraphRouter } from './modules/content-graph/content-graph.routes.js';
import { devRouter } from './modules/dev/dev.routes.js';
import { economyRouter } from './modules/economy/economy.routes.js';
import { examRouter } from './modules/exam/exam.routes.js';
import { flightRouter } from './modules/flight/flight.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { masteryRouter } from './modules/mastery/mastery.routes.js';
import { readinessRouter } from './modules/readiness/readiness.routes.js';
import { recallRouter } from './modules/recall/recall.routes.js';
import { schedulerRouter } from './modules/scheduler/scheduler.routes.js';

export function createApp(
  options: { testClockEnabled?: boolean } = {},
): Express {
  const { testClockEnabled = env.TEST_CLOCK_ENABLED } = options;
  const app = express();

  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(express.json());
  app.use(requestLogger);

  app.use(healthRouter);
  app.use('/api/content-graph', contentGraphRouter);
  app.use('/api/scheduler', schedulerRouter);
  app.use('/api/mastery', masteryRouter);
  app.use('/api/adaptive', adaptiveRouter);
  app.use('/api/composition', compositionRouter);
  app.use('/api/economy', economyRouter);
  app.use('/api/flight', flightRouter);
  app.use('/api/readiness', readinessRouter);
  app.use('/api/recall', recallRouter);
  app.use('/api/exam', examRouter);

  // Dev and staging only. Not mounted otherwise, so the routes don't exist -
  // and env.ts refuses TEST_CLOCK_ENABLED in production.
  if (testClockEnabled) {
    app.use('/api/dev', devRouter);
  }

  // Error handler must be registered last.
  app.use(errorHandler);

  return app;
}
