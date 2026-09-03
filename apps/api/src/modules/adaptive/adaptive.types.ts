export interface ReviewLite {
  grade: 'AGAIN' | 'GOOD';
  reviewedAt: Date;
  renderingId: string | null;
}

export interface DerivedRemediationState {
  /** True the moment an Again is unresolved; false once two qualifying corrects land. */
  inRemediation: boolean;
  enteredAt: Date | null;
  /** The timestamp of the second qualifying correct answer, if any. */
  exitedAt: Date | null;
}

export interface ItemRemediationRow extends DerivedRemediationState {
  knowledgeItemId: string;
  moduleId: string;
  moduleName: string;
}
