import type { ExamRunStatus } from '@ogwi/shared';

export type { ExamPaper, ExamQuestion, ExamResults, ExamRunStatus } from '@ogwi/shared';

export interface EligibleItem {
  knowledgeItemId: string;
  /** The exact BASE rendering the paper will serve and later mark against. */
  renderingId: string;
}

export interface ModuleEligibleItems {
  moduleId: string;
  order: number;
  blueprintWeight: number;
  eligibleItems: EligibleItem[];
}

export interface NewExamRunItem {
  knowledgeItemId: string;
  renderingId: string;
  position: number;
}

export interface ExamRunItemRow {
  id: string;
  knowledgeItemId: string;
  renderingId: string;
  position: number;
  selectedOptionIndex: number | null;
  correct: boolean | null;
  gradedAt: Date | null;
}

export interface ExamRunRow {
  id: string;
  learnerId: string;
  qualificationId: string;
  qualificationSlug: string;
  qualificationName: string;
  status: ExamRunStatus;
  questionCount: number;
  allottedSeconds: number;
  startedAt: Date;
  submittedAt: Date | null;
  correctCount: number | null;
  scoredCount: number | null;
  passed: boolean | null;
  passMarkSnapshot: number;
  items: ExamRunItemRow[];
}
