import { describe, expect, it } from 'vitest';
import { buildUnlockChecklist } from '../unlock-checklist.util.js';

const nothing = { completedTopics: 0, modulesTouched: 0, moduleCount: 3, submittedExamRuns: 0 };

describe('buildUnlockChecklist', () => {
  it('starts with nothing ticked and stays locked', () => {
    const checklist = buildUnlockChecklist(nothing);

    expect(checklist.unlocked).toBe(false);
    expect(checklist.items.map((item) => item.key)).toEqual(['first_topic', 'modules', 'first_exam_run']);
    expect(checklist.items.every((item) => !item.done)).toBe(true);
  });

  it('ticks each item as it is earned, and unlocks only when all three are', () => {
    const twoOfThree = buildUnlockChecklist({ ...nothing, completedTopics: 1, modulesTouched: 2 });
    expect(twoOfThree.items.map((item) => item.done)).toEqual([true, true, false]);
    expect(twoOfThree.unlocked).toBe(false);

    const all = buildUnlockChecklist({ ...nothing, completedTopics: 1, modulesTouched: 2, submittedExamRuns: 1 });
    expect(all.unlocked).toBe(true);
  });

  it('needs two modules when the qualification has them', () => {
    const one = buildUnlockChecklist({ ...nothing, modulesTouched: 1 });
    expect(one.items[1]).toEqual({ key: 'modules', current: 1, required: 2, done: false });
  });

  it("caps the module requirement at the qualification's module count, so one-module courses can unlock", () => {
    const checklist = buildUnlockChecklist({
      completedTopics: 1,
      modulesTouched: 1,
      moduleCount: 1,
      submittedExamRuns: 1,
    });

    expect(checklist.items[1]).toEqual({ key: 'modules', current: 1, required: 1, done: true });
    expect(checklist.unlocked).toBe(true);
  });

  it('reports progress without overshooting the requirement', () => {
    const checklist = buildUnlockChecklist({ ...nothing, completedTopics: 4, submittedExamRuns: 3 });

    expect(checklist.items[0]).toMatchObject({ current: 1, required: 1 });
    expect(checklist.items[2]).toMatchObject({ current: 1, required: 1 });
  });
});
