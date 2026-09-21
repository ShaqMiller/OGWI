import type { RenderingFormat } from '../schemas/content-graph.schema.js';

/**
 * Exam Simulation (Doc 2 A5): "one entry generating a fresh randomised paper
 * each time (question count and allotted time shown)".
 *
 * The spec never fixes a question count or a duration - "Question 4 of 30" is
 * illustrative copy and B8's "typical 30-question mock" is an economy
 * calibration anchor, not a rule. Doc 2 Part D says unspecified behaviour
 * "must be raised, not invented", so these were raised and agreed rather than
 * quietly assumed. They are starting points, not researched values.
 */

/** What a full paper aims for. The real paper is capped by available content. */
export const EXAM_TARGET_QUESTION_COUNT = 30;

/** Allotted time is derived from the ACTUAL paper size, never the target. */
export const EXAM_SECONDS_PER_QUESTION = 90;

/**
 * The mini-mock (Doc 2 B2: "10-20 questions, ~10 minutes"). 15 sits in the
 * middle of the spec's range, and 40 seconds a question makes 15 questions ten
 * minutes. Both are defaults the spec leaves open.
 */
export const MINI_MOCK_TARGET_QUESTION_COUNT = 15;
export const MINI_MOCK_SECONDS_PER_QUESTION = 40;

/** Below this, there isn't enough content to make a paper worth sitting. */
export const EXAM_MIN_QUESTION_COUNT = 1;

/**
 * Only items whose BASE rendering is in a format the marker can actually
 * grade are eligible. This must stay in step with the option-index formats in
 * apps/api/src/modules/content-graph/answer-check.util.ts - an item in an
 * unsupported format would render with zero options, be unanswerable, and
 * then fail marking at submit.
 */
export const EXAM_SUPPORTED_FORMATS: readonly RenderingFormat[] = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'PICK_AN_IMAGE',
];

export const EXAM_CONFIG_VERSION = 'exam-simulation-1';
