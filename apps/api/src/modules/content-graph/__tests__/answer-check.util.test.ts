import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../answer-check.util.js';

const VALID_CONTENT = {
  prompt: 'Which class does the IP address 192.168.1.1 belong to?',
  options: ['Class A', 'Class B', 'Class C', 'Class D'],
  correctOptionIndex: 2,
};

const pick = (selectedOptionIndex: number) =>
  ({ kind: 'option_index', selectedOptionIndex }) as const;

describe('checkAnswer', () => {
  it('marks the correct option correct and reports the key', () => {
    const result = checkAnswer('MULTIPLE_CHOICE', VALID_CONTENT, pick(2));

    expect(result).toEqual({ ok: true, correct: true, correctOptionIndex: 2 });
  });

  it('marks a wrong option incorrect but still reports the key', () => {
    // The key is what the learner is shown as feedback, so it comes back on
    // a miss too - the endpoint only discloses it after an answer is committed.
    const result = checkAnswer('MULTIPLE_CHOICE', VALID_CONTENT, pick(0));

    expect(result).toEqual({ ok: true, correct: false, correctOptionIndex: 2 });
  });

  it('accepts the other option-index formats', () => {
    const trueFalse = { prompt: 'TCP is connection-oriented.', options: ['True', 'False'], correctOptionIndex: 0 };

    expect(checkAnswer('TRUE_FALSE', trueFalse, pick(0))).toEqual({
      ok: true,
      correct: true,
      correctOptionIndex: 0,
    });
  });

  it('rejects an option index past the end of the list rather than grading it wrong', () => {
    // A client bug must not write a real `again` into the learner's memory state.
    expect(checkAnswer('MULTIPLE_CHOICE', VALID_CONTENT, pick(99))).toEqual({
      ok: false,
      reason: 'out_of_range',
    });
  });

  it('rejects an option-index answer against a format that does not take one', () => {
    expect(checkAnswer('TYPED_SHORT_ANSWER', VALID_CONTENT, pick(0))).toEqual({
      ok: false,
      reason: 'format_mismatch',
    });
  });

  describe('malformed stored content', () => {
    /**
     * The repository used to substitute `correctOptionIndex ?? -1` for
     * missing content, which silently turned an authoring defect into a
     * question no answer could ever match. Each of these must now be a
     * reported defect instead.
     */
    const cases: [string, unknown][] = [
      ['a stored -1 sentinel', { ...VALID_CONTENT, correctOptionIndex: -1 }],
      ['a correctOptionIndex past the options', { ...VALID_CONTENT, correctOptionIndex: 4 }],
      ['a missing correctOptionIndex', { prompt: 'q', options: ['a', 'b'] }],
      ['missing options', { prompt: 'q', correctOptionIndex: 0 }],
      ['a single option', { prompt: 'q', options: ['only'], correctOptionIndex: 0 }],
      ['an empty prompt', { ...VALID_CONTENT, prompt: '' }],
      ['a blank option', { prompt: 'q', options: ['a', ''], correctOptionIndex: 0 }],
      ['non-string options', { prompt: 'q', options: [1, 2], correctOptionIndex: 0 }],
      ['a non-object content blob', 'not content at all'],
    ];

    it.each(cases)('reports %s as malformed', (_label, content) => {
      expect(checkAnswer('MULTIPLE_CHOICE', content, pick(0))).toEqual({
        ok: false,
        reason: 'malformed_content',
      });
    });

    it('never treats -1 as "this question has no correct answer"', () => {
      const result = checkAnswer('MULTIPLE_CHOICE', { ...VALID_CONTENT, correctOptionIndex: -1 }, pick(-1 as number));

      expect(result.ok).toBe(false);
    });
  });
});
