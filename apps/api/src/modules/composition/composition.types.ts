export interface TopicWithObjectives {
  topicId: string;
  topicName: string;
  topicOrder: number;
  moduleId: string;
  moduleName: string;
  moduleOrder: number;
  hasActivitySlot: boolean;
  objectives: {
    id: string;
    kind: 'FACT_HEAVY' | 'CONCEPTUAL';
    knowledgeItemIds: string[];
  }[];
}

export interface CompositionDueItem {
  knowledgeItemId: string;
  due: Date | null;
  isNew: boolean;
}
