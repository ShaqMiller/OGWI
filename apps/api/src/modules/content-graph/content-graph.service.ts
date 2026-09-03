import { NotFoundError } from '../../errors/index.js';
import * as contentGraphRepository from './content-graph.repository.js';
import type { QualificationWithModules } from './content-graph.types.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 */

export async function getQualificationBySlug(slug: string): Promise<QualificationWithModules> {
  const qualification = await contentGraphRepository.findQualificationBySlug(slug);

  if (!qualification) {
    throw new NotFoundError(`No qualification with slug "${slug}"`);
  }

  return qualification;
}

export async function listQualifications(): Promise<QualificationWithModules[]> {
  return contentGraphRepository.listQualifications();
}

export async function getKnowledgeItemPrompt(
  knowledgeItemId: string,
): Promise<contentGraphRepository.KnowledgeItemPrompt> {
  const prompt = await contentGraphRepository.findKnowledgeItemPrompt(knowledgeItemId);

  if (!prompt) {
    throw new NotFoundError(`No renderable content for knowledge item "${knowledgeItemId}"`);
  }

  return prompt;
}

export async function getQualificationIdForKnowledgeItem(
  knowledgeItemId: string,
): Promise<string | null> {
  return contentGraphRepository.findQualificationIdForKnowledgeItem(knowledgeItemId);
}
