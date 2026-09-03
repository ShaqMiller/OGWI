import {
  multipleChoiceContentSchema,
  type KnowledgeItemPrompt,
  type SubmittedAnswer,
} from '@ogwi/shared';
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

export interface BulkAnswerEntry {
  knowledgeItemId: string;
  renderingId: string;
  answer: SubmittedAnswer;
}

/**
 * Marks a whole paper in one pass - one query, then the pure checker in
 * memory. Exam submission would otherwise do a database round trip per
 * question just to look up something it is not allowed to reveal.
 *
 * Keeping this here rather than in the exam module preserves the property
 * that content-graph is the only place a correct answer is ever read.
 */
export async function checkAnswers(
  entries: BulkAnswerEntry[],
): Promise<Map<string, AnswerVerdict>> {
  if (entries.length === 0) return new Map();

  const renderings = await contentGraphRepository.findGradableRenderings(
    entries.map(({ knowledgeItemId, renderingId }) => ({ knowledgeItemId, renderingId })),
  );

  const verdicts = new Map<string, AnswerVerdict>();

  for (const entry of entries) {
    const rendering = renderings.get(entry.renderingId);

    if (!rendering) {
      throw new NotFoundError(
        `No rendering "${entry.renderingId}" for knowledge item "${entry.knowledgeItemId}"`,
      );
    }

    const result = answerCheckUtil.checkAnswer(rendering.format, rendering.content, entry.answer);

    if (!result.ok) {
      if (result.reason === 'malformed_content') {
        throw new Error(
          `Rendering "${entry.renderingId}" has malformed ${rendering.format} content`,
        );
      }
      throw new ValidationError(`Answer is not applicable to rendering "${entry.renderingId}"`, {
        reason: result.reason,
        knowledgeItemId: entry.knowledgeItemId,
      });
    }

    verdicts.set(entry.knowledgeItemId, {
      correct: result.correct,
      correctOptionIndex: result.correctOptionIndex,
    });
  }

  return verdicts;
}

export interface AnswerKey {
  correctOptionIndex: number;
  explanation: string | null;
}

/**
 * The answer keys for a set of served renderings.
 *
 * Separate from checkAnswers because the results screen needs the key for
 * every question including unanswered ones, where there is no submitted
 * answer to check. Only ever called after a run is submitted.
 */
export async function findAnswerKeys(
  pairs: { knowledgeItemId: string; renderingId: string }[],
): Promise<Map<string, AnswerKey>> {
  const renderings = await contentGraphRepository.findGradableRenderings(pairs);
  const keys = new Map<string, AnswerKey>();

  for (const pair of pairs) {
    const rendering = renderings.get(pair.renderingId);
    if (!rendering) continue;

    const parsed = multipleChoiceContentSchema.safeParse(rendering.content);
    if (!parsed.success) continue;

    keys.set(pair.knowledgeItemId, {
      correctOptionIndex: parsed.data.correctOptionIndex,
      explanation: parsed.data.explanation ?? null,
    });
  }

  return keys;
}

/**
 * How many options a rendering offers, for range-validating a saved answer
 * without marking it. Returning the count leaks only what the client already
 * rendered, and lets the exam module validate input while never holding a
 * correct answer in memory outside checkAnswers.
 */
export async function getOptionCount(
  knowledgeItemId: string,
  renderingId: string,
): Promise<number> {
  const rendering = await contentGraphRepository.findGradableRendering(
    knowledgeItemId,
    renderingId,
  );

  if (!rendering) {
    throw new NotFoundError(
      `No rendering "${renderingId}" for knowledge item "${knowledgeItemId}"`,
    );
  }

  const parsed = multipleChoiceContentSchema.safeParse(rendering.content);

  if (!parsed.success) {
    throw new Error(`Rendering "${renderingId}" has malformed ${rendering.format} content`);
  }

  return parsed.data.options.length;
}

export async function getQualificationIdForKnowledgeItem(
  knowledgeItemId: string,
): Promise<string | null> {
  return contentGraphRepository.findQualificationIdForKnowledgeItem(knowledgeItemId);
}
