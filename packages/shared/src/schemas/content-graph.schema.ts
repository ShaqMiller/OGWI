import { z } from 'zod';

/**
 * Content graph shapes (Doc 2 B10 / A1): Qualification -> Module -> Topic ->
 * Objective -> KeyPoint / KnowledgeItem -> Rendering. This is the single
 * source of truth for everything a learner is ever shown or tested on.
 *
 * Kept intentionally close to the handover spec's shape but not locked to
 * every numeric rule in it (build-time gate *values* like "5-10 items per
 * topic" are recorded as constants in packages/shared/src/constants so they
 * can be revisited without touching the schema).
 */

export const objectiveKindSchema = z.enum(['fact_heavy', 'conceptual']);
export type ObjectiveKind = z.infer<typeof objectiveKindSchema>;

// Matches the Prisma KeyPointTier enum (CRITICAL/SUPPORTING) - this was
// previously lowercase and never actually round-tripped real data, since
// nothing exposed a KeyPoint through the API until the recall module.
export const keyPointTierSchema = z.enum(['CRITICAL', 'SUPPORTING']);
export type KeyPointTier = z.infer<typeof keyPointTierSchema>;

// Matches the Prisma RenderingFormat/RenderingRole enums, for the same
// reason keyPointTierSchema above was flipped: these were lowercase and
// never round-tripped real data, so the mismatch stayed hidden behind
// knowledgeItemPromptSchema's bare z.string() `format`. That bare string is
// gone now that answer checking branches on format, so the casing has to
// agree with what the database actually stores.
export const renderingFormatSchema = z.enum([
  'MULTIPLE_CHOICE',
  'MULTIPLE_RESPONSE',
  'TRUE_FALSE',
  'TYPED_SHORT_ANSWER',
  'AI_MARKED_LONG_ANSWER',
  'SEQUENCING',
  'MATCHING',
  'FILL_IN_THE_BLANKS',
  'SORTING',
  'PICK_AN_IMAGE',
]);
export type RenderingFormat = z.infer<typeof renderingFormatSchema>;

export const renderingRoleSchema = z.enum(['BASE', 'VARIANT', 'LADDER']);
export type RenderingRole = z.infer<typeof renderingRoleSchema>;

/**
 * The authored-content contract for a MULTIPLE_CHOICE rendering's `content`
 * JSON. Rendering.content is an untyped Json column, so this is the only
 * thing standing between an authoring mistake and a broken question.
 *
 * `correctOptionIndex` is validated *against* `options` rather than being
 * merely an integer: an out-of-range key (or the -1 this used to silently
 * default to) is a defect, not a question with no right answer.
 */
export const multipleChoiceContentSchema = z
  .object({
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    correctOptionIndex: z.number().int().nonnegative(),
  })
  .refine((content) => content.correctOptionIndex < content.options.length, {
    message: 'correctOptionIndex is out of range for options',
    path: ['correctOptionIndex'],
  });
export type MultipleChoiceContent = z.infer<typeof multipleChoiceContentSchema>;

export const qualificationSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  contentGraphVersion: z.string().min(1),
  createdAt: z.coerce.date(),
  // The single bar for mastered states and readiness (Doc 2 C6). 0-1.
  passMark: z.number().min(0).max(1),
});
export type Qualification = z.infer<typeof qualificationSchema>;

export const moduleSchema = z.object({
  id: z.string().uuid(),
  qualificationId: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  blueprintWeight: z.number().min(0).max(1),
});
export type ModuleEntity = z.infer<typeof moduleSchema>;

export const topicSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  flowTemplate: z.string().min(1).nullable(),
});
export type Topic = z.infer<typeof topicSchema>;

export const objectiveSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  kind: objectiveKindSchema,
  subWeight: z.number().min(0).max(1).nullable(),
});
export type Objective = z.infer<typeof objectiveSchema>;

export const keyPointSchema = z.object({
  id: z.string().uuid(),
  objectiveId: z.string().uuid(),
  plainName: z.string().min(1),
  cueQuestion: z.string().min(1),
  tier: keyPointTierSchema,
});
export type KeyPoint = z.infer<typeof keyPointSchema>;

export const knowledgeItemSchema = z.object({
  id: z.string().uuid(),
  objectiveId: z.string().uuid(),
  keyPointId: z.string().uuid().nullable(),
});
export type KnowledgeItem = z.infer<typeof knowledgeItemSchema>;

export const renderingSchema = z.object({
  id: z.string().uuid(),
  knowledgeItemId: z.string().uuid(),
  role: renderingRoleSchema,
  format: renderingFormatSchema,
  content: z.record(z.string(), z.unknown()),
  lastServedAt: z.coerce.date().nullable(),
});
export type Rendering = z.infer<typeof renderingSchema>;

/**
 * The display shape for a knowledge item's BASE rendering (GET
 * /api/content-graph/knowledge-items/:id). Assumes multiple-choice, same
 * simplification as the endpoint itself - broaden once other formats exist.
 *
 * Deliberately carries NO correct answer. This endpoint is unauthenticated
 * ("browsing is pre-auth", see content-graph.routes.ts), so shipping the key
 * here made it publicly readable for any item id. The key is now revealed
 * only by POST /api/scheduler/answers, in the response to a committed
 * answer. `renderingId` is what the learner answers against, and it is
 * echoed back on submission so the server can verify and log which rendering
 * was actually served.
 */
export const knowledgeItemPromptSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  renderingId: z.string().uuid(),
  format: renderingFormatSchema,
  prompt: z.string(),
  options: z.array(z.string()),
});
export type KnowledgeItemPrompt = z.infer<typeof knowledgeItemPromptSchema>;

export const contentGraphValidationIssueSchema = z.object({
  gate: z.string().min(1),
  entityType: z.enum(['topic', 'objective', 'knowledgeItem']),
  entityId: z.string().uuid(),
  message: z.string().min(1),
});
export type ContentGraphValidationIssue = z.infer<typeof contentGraphValidationIssueSchema>;
