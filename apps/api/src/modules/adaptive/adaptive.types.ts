import type { ReviewSource } from '@ogwi/shared';

export interface ReviewLite {
  grade: 'AGAIN' | 'GOOD';
  reviewedAt: Date;
  renderingId: string | null;
}

export interface QualifyingAnswer {
  reviewedAt: Date;
  /** The UTC calendar day it counted for. */
  day: string;
  renderingId: string | null;
}

export interface DerivedRemediationState {
  /** True the moment an Again is unresolved; false once two qualifying corrects land. */
  inRemediation: boolean;
  /** The most recent Again - each one resets progress toward exit. */
  enteredAt: Date | null;
  /** The timestamp of the second qualifying correct answer, if any. */
  exitedAt: Date | null;
  /** Agains in the current episode: 1, plus any further misses before it exits. 0 if never entered. */
  againCount: number;
  /** Correct answers that have counted toward exit since the last Again. */
  qualifyingAnswers: QualifyingAnswer[];
  /** How many more qualifying correct answers exit needs. 0 once exited, or if never entered. */
  correctAnswersNeeded: number;
  /** When a correct answer will next count: at once after a miss, else from the next UTC day. Null unless in remediation. */
  nextQualifyingFrom: Date | null;
  renderingDistinctnessEnforced: boolean;
}

export interface ItemRemediationRow extends DerivedRemediationState {
  knowledgeItemId: string;
  moduleId: string;
  moduleName: string;
  /** Where the Again behind `enteredAt` came from. */
  source: ReviewSource;
}
