import type { KnowledgeItemPrompt, SubmittedAnswer } from '@ogwi/shared';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import * as answerCheckUtil from './answer-check.util.js';
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
): Promise<KnowledgeItemPrompt> {
  const prompt = await contentGraphRepository.findKnowledgeItemPrompt(knowledgeItemId);

  if (!prompt) {
    throw new NotFoundError(`No renderable content for knowledge item "${knowledgeItemId}"`);
  }

  return prompt;
}

export interface AnswerVerdict {
  correct: boolean;
  correctOptionIndex: number;
}

/**
 * Marks a submitted answer against the rendering the learner was actually
 * served. The only place the correct answer is read on the write path.
 *
 * Callers MUST run this before recording anything: gradeReview writes across
 * four modules without a transaction, so a rejection after the first write
 * would leave a half-recorded review.
 */
export async function checkAnswer(
  knowledgeItemId: string,
  renderingId: string,
  answer: SubmittedAnswer,
): Promise<AnswerVerdict> {
  const rendering = await contentGraphRepository.findGradableRendering(
    knowledgeItemId,
    renderingId,
  );

  if (!rendering) {
    throw new NotFoundError(
      `No rendering "${renderingId}" for knowledge item "${knowledgeItemId}"`,
    );
  }

  const result = answerCheckUtil.checkAnswer(rendering.format, rendering.content, answer);

  if (!result.ok) {
    switch (result.reason) {
      case 'out_of_range':
      case 'format_mismatch':
        // A client defect. Grading it as `again` would corrupt real memory
        // state off the back of a frontend bug, so refuse it instead.
        throw new ValidationError(
          `Answer is not applicable to rendering "${renderingId}"`,
          { reason: result.reason },
        );
      case 'malformed_content':
        // A server-side data defect. Loud on purpose: this must page whoever
        // authored the content, not read to the learner as "no question here".
        throw new Error(
          `Rendering "${renderingId}" has malformed ${rendering.format} content`,
        );
    }
  }

  return { correct: result.correct, correctOptionIndex: result.correctOptionIndex };
}

export async function countRenderingsByItem(
  knowledgeItemIds: string[],
): Promise<Map<string, number>> {
  return contentGraphRepository.countRenderingsByItem(knowledgeItemIds);
}

export async function getQualificationIdForKnowledgeItem(
  knowledgeItemId: string,
): Promise<string | null> {
  return contentGraphRepository.findQualificationIdForKnowledgeItem(knowledgeItemId);
}
