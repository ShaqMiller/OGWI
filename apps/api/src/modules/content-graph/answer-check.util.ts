import {
  multipleChoiceContentSchema,
  type RenderingFormat,
  type SubmittedAnswer,
} from '@ogwi/shared';

/**
 * Decides whether a submitted answer is correct, given a rendering's stored
 * content. Pure: no DB, no throwing - it returns a discriminated result and
 * lets the service decide which HTTP error each failure deserves. Same shape
 * as physics.util / remediation.util / normal-cdf.util.
 *
 * This is the single place in the codebase that knows what "correct" means.
 * Adding a format (typed short answer, multiple response) means adding an
 * arm here and a member to submittedAnswerSchema - nothing outside
 * content-graph needs to change.
 */

export type AnswerCheckFailure =
  /** The rendering's stored content doesn't satisfy its format's contract - an authoring/data defect. */
  | 'malformed_content'
  /** The answer references an option that doesn't exist - a client defect, not a wrong answer. */
  | 'out_of_range'
  /** The answer's shape can't be applied to this rendering's format. */
  | 'format_mismatch';

export type AnswerCheckResult =
  | { ok: true; correct: boolean; correctOptionIndex: number }
  | { ok: false; reason: AnswerCheckFailure };

/** Formats whose answer is a single index into `options`. */
const OPTION_INDEX_FORMATS: ReadonlySet<RenderingFormat> = new Set<RenderingFormat>([
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'PICK_AN_IMAGE',
]);

export function checkAnswer(
  format: RenderingFormat,
  content: unknown,
  answer: SubmittedAnswer,
): AnswerCheckResult {
  switch (answer.kind) {
    case 'option_index': {
      if (!OPTION_INDEX_FORMATS.has(format)) {
        return { ok: false, reason: 'format_mismatch' };
      }

      // Note this rejects a stored correctOptionIndex of -1 outright. That
      // sentinel used to be substituted for missing content, which quietly
      // turned an authoring defect into an unanswerable question.
      const parsed = multipleChoiceContentSchema.safeParse(content);
      if (!parsed.success) {
        return { ok: false, reason: 'malformed_content' };
      }

      const { options, correctOptionIndex } = parsed.data;
      if (answer.selectedOptionIndex >= options.length) {
        return { ok: false, reason: 'out_of_range' };
      }

      return {
        ok: true,
        correct: answer.selectedOptionIndex === correctOptionIndex,
        correctOptionIndex,
      };
    }

    default: {
      // Exhaustiveness guard: adding a member to submittedAnswerSchema
      // without an arm above becomes a compile error, not a runtime 500.
      const unhandled: never = answer.kind;
      return unhandled;
    }
  }
}
