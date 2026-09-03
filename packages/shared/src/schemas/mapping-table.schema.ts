import { z } from 'zod';

/**
 * The mapping table (Doc 2 B1 / Doc 3 hub): item <-> objective <-> module <->
 * blueprint weight. Owned by the mastery module; every scoring system reads
 * this instead of walking the content graph itself. It is a derived,
 * read-only view over the content graph - never hand-authored.
 */
export const mappingTableEntrySchema = z.object({
  knowledgeItemId: z.string().uuid(),
  objectiveId: z.string().uuid(),
  topicId: z.string().uuid(),
  moduleId: z.string().uuid(),
  qualificationId: z.string().uuid(),
  moduleBlueprintWeight: z.number().min(0).max(1),
  objectiveSubWeight: z.number().min(0).max(1).nullable(),
});
export type MappingTableEntry = z.infer<typeof mappingTableEntrySchema>;
