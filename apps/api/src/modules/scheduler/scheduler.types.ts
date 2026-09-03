import type { PersistedCardFields } from './fsrs.util.js';

export interface GradedItemState extends PersistedCardFields {
  knowledgeItemId: string;
}

export interface DueItem {
  knowledgeItemId: string;
  due: Date | null;
  isNew: boolean;
}
