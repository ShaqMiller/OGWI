export interface ModuleWithItems {
  id: string;
  name: string;
  blueprintWeight: number;
  objectives: {
    id: string;
    subWeight: number | null;
    knowledgeItemIds: string[];
  }[];
}
