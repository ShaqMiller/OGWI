import { Router, type Router as RouterType } from 'express';
import {
  getKnowledgeItemPrompt,
  getQualification,
  listQualifications,
} from './content-graph.controller.js';

export const contentGraphRouter: RouterType = Router();

// Browsing qualifications is pre-auth (Doc 2 A11: browse -> pick -> begin,
// no placement test, no login gate on the front door).
contentGraphRouter.get('/qualifications', listQualifications);
contentGraphRouter.get('/qualifications/:slug', getQualification);
contentGraphRouter.get('/knowledge-items/:id', getKnowledgeItemPrompt);
