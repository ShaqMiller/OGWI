import {
  READINESS_UNLOCK_EXAM_RUNS_REQUIRED,
  READINESS_UNLOCK_MODULES_REQUIRED,
  READINESS_UNLOCK_TOPICS_REQUIRED,
  type UnlockChecklist,
  type UnlockChecklistItem,
} from '@ogwi/shared';

/**
 * The first-score unlock (Doc 2 B2): "The readiness surface begins as a
 * visible three-item checklist, each ticking as earned: complete your first
 * topic · answer questions across at least two modules · complete one
 * mini-mock." Until all three tick, no odds are published at all - and because
 * one of them is an exam run, every score ever shown has been calibrated from
 * its first appearance.
 *
 * Two adaptations, both recorded as defaults to confirm:
 *   - "Two modules" is capped at the qualification's module count. Both demo
 *     qualifications have a single module, and taken literally the rule would
 *     make a score unreachable - the same deadlock rendering distinctness had
 *     on single-rendering content.
 *   - "Mini-mock" is any submitted Exam Simulation. There is no mini-mock run
 *     kind yet, and a full paper is a superset of one.
 *
 * Pure: the caller supplies the counts.
 */
export function buildUnlockChecklist(counts: {
  completedTopics: number;
  modulesTouched: number;
  moduleCount: number;
  submittedExamRuns: number;
}): UnlockChecklist {
  const modulesRequired = Math.max(1, Math.min(READINESS_UNLOCK_MODULES_REQUIRED, counts.moduleCount));

  const items: UnlockChecklistItem[] = [
    item('first_topic', counts.completedTopics, READINESS_UNLOCK_TOPICS_REQUIRED),
    item('modules', counts.modulesTouched, modulesRequired),
    item('first_exam_run', counts.submittedExamRuns, READINESS_UNLOCK_EXAM_RUNS_REQUIRED),
  ];

  return { unlocked: items.every((entry) => entry.done), items };
}

function item(key: UnlockChecklistItem['key'], current: number, required: number): UnlockChecklistItem {
  return { key, current: Math.min(current, required), required, done: current >= required };
}
