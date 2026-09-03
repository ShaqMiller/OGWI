import { Router, type Router as RouterType } from 'express';
import { requireLearner } from '../../middleware/requireLearner.js';
import {
  getExamPaper,
  getExamResults,
  saveExamAnswer,
  startExamRun,
  submitExamRun,
} from './exam.controller.js';

export const examRouter: RouterType = Router();

examRouter.use(requireLearner);

/**
 * Exam runs (Doc 2 A5). Every route is scoped to the calling learner, and a
 * run belonging to someone else returns 404 rather than 403 - "no such run"
 * and "not yours" must be indistinguishable so ids can't be probed.
 *
 * The split between these routes is the invariant-10 boundary in HTTP form:
 * GET /runs/:runId and POST /runs/:runId/answers carry no correctness
 * information whatsoever, and the answer key appears only on the two routes
 * that require a submitted run.
 */
examRouter.post('/runs', startExamRun);
examRouter.get('/runs/:runId', getExamPaper);
examRouter.post('/runs/:runId/answers', saveExamAnswer);
examRouter.post('/runs/:runId/submit', submitExamRun);
examRouter.get('/runs/:runId/results', getExamResults);
