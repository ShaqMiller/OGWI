import { EXAM_SUPPORTED_FORMATS } from '@ogwi/shared';
import type { RenderingFormat as PrismaRenderingFormat } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type {
  ExamRunItemRow,
  ExamRunRow,
  ModuleEligibleItems,
  NewExamRunItem,
} from './exam.types.js';

/**
 * The only file in this module allowed to import the Prisma client.
 */

/**
 * Eligible items per module, for paper generation.
 *
 * "Eligible" means the item has a BASE rendering in a format the marker can
 * actually grade. Without that filter an item whose BASE rendering is, say,
 * SEQUENCING would be served with zero options, be unanswerable, and then
 * fail marking at submit.
 *
 * Renderings are ordered `createdAt asc` so that when an item somehow has two
 * BASE renderings, the paper picks the same one findKnowledgeItemPrompt
 * would - one tie-break rule in the codebase, not two.
 */
export async function findEligibleItemsByModule(
  qualificationId: string,
): Promise<ModuleEligibleItems[]> {
  const modules = await prisma.module.findMany({
    where: { qualificationId },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      order: true,
      blueprintWeight: true,
      topics: {
        select: {
          objectives: {
            select: {
              knowledgeItems: {
                select: {
                  id: true,
                  renderings: {
                    where: {
                      role: 'BASE',
                      format: { in: EXAM_SUPPORTED_FORMATS as unknown as PrismaRenderingFormat[] },
                    },
                    orderBy: { createdAt: 'asc' },
                    take: 1,
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return modules.map((module) => ({
    moduleId: module.id,
    order: module.order,
    blueprintWeight: Number(module.blueprintWeight),
    eligibleItems: module.topics
      .flatMap((topic) => topic.objectives)
      .flatMap((objective) => objective.knowledgeItems)
      .filter((item) => item.renderings.length > 0)
      .map((item) => ({
        knowledgeItemId: item.id,
        renderingId: (item.renderings[0] as { id: string }).id,
      })),
  }));
}

export async function createRun(params: {
  learnerId: string;
  qualificationId: string;
  questionCount: number;
  allottedSeconds: number;
  contentGraphVersion: string;
  passMark: number;
  items: NewExamRunItem[];
}): Promise<string> {
  const run = await prisma.examRun.create({
    data: {
      learnerId: params.learnerId,
      qualificationId: params.qualificationId,
      kind: 'SIMULATION',
      questionCount: params.questionCount,
      allottedSeconds: params.allottedSeconds,
      contentGraphVersion: params.contentGraphVersion,
      passMarkSnapshot: params.passMark,
      items: { create: params.items },
    },
    select: { id: true },
  });

  return run.id;
}

/** Always scoped by learnerId: another learner's run must be indistinguishable from a missing one. */
export async function findRun(runId: string, learnerId: string): Promise<ExamRunRow | null> {
  const run = await prisma.examRun.findFirst({
    where: { id: runId, learnerId },
    include: {
      qualification: { select: { slug: true, name: true } },
      items: { orderBy: { position: 'asc' } },
    },
  });

  if (!run) return null;

  return {
    id: run.id,
    learnerId: run.learnerId,
    qualificationId: run.qualificationId,
    qualificationSlug: run.qualification.slug,
    qualificationName: run.qualification.name,
    status: run.status,
    questionCount: run.questionCount,
    allottedSeconds: run.allottedSeconds,
    startedAt: run.startedAt,
    submittedAt: run.submittedAt,
    correctCount: run.correctCount,
    scoredCount: run.scoredCount,
    passed: run.passed,
    passMarkSnapshot: Number(run.passMarkSnapshot),
    items: run.items.map(toDomainItem),
  };
}

function toDomainItem(row: {
  id: string;
  knowledgeItemId: string;
  renderingId: string;
  position: number;
  selectedOptionIndex: number | null;
  correct: boolean | null;
  gradedAt: Date | null;
}): ExamRunItemRow {
  return {
    id: row.id,
    knowledgeItemId: row.knowledgeItemId,
    renderingId: row.renderingId,
    position: row.position,
    selectedOptionIndex: row.selectedOptionIndex,
    correct: row.correct,
    gradedAt: row.gradedAt,
  };
}

/**
 * Saves a selection, conditional on the run still being in progress, in one
 * statement. The status check lives in the WHERE rather than in a preceding
 * read so a save racing a submit can never mutate a graded run: it simply
 * matches nothing.
 *
 * Returns false when nothing matched - the caller then works out whether that
 * was "not yours", "not on this paper" or "already submitted".
 */
export async function saveSelection(params: {
  runId: string;
  learnerId: string;
  knowledgeItemId: string;
  selectedOptionIndex: number;
}): Promise<boolean> {
  const result = await prisma.examRunItem.updateMany({
    where: {
      examRunId: params.runId,
      knowledgeItemId: params.knowledgeItemId,
      examRun: { learnerId: params.learnerId, status: 'IN_PROGRESS' },
    },
    data: { selectedOptionIndex: params.selectedOptionIndex, selectedAt: new Date() },
  });

  return result.count > 0;
}

/**
 * Writes every item's mark and flips the run to SUBMITTED, atomically.
 *
 * The conditional run update IS the lock: only one concurrent submit can move
 * the status, and a caller that loses gets `false` and reads the winner's
 * result rather than erroring.
 */
export async function finaliseRun(params: {
  runId: string;
  marks: { itemId: string; correct: boolean | null }[];
  correctCount: number;
  scoredCount: number;
  passed: boolean;
  submittedAt: Date;
}): Promise<boolean> {
  const results = await prisma.$transaction([
    ...params.marks.map((mark) =>
      prisma.examRunItem.updateMany({
        where: { id: mark.itemId },
        data: { correct: mark.correct },
      }),
    ),
    prisma.examRun.updateMany({
      where: { id: params.runId, status: 'IN_PROGRESS' },
      data: {
        status: 'SUBMITTED',
        submittedAt: params.submittedAt,
        correctCount: params.correctCount,
        scoredCount: params.scoredCount,
        passed: params.passed,
      },
    }),
  ]);

  // $transaction returns results positionally, and the run update is last -
  // so it is at index marks.length, not 1. Reading index 1 happened to work
  // only for a one-question paper; on any real paper it read an item update.
  const runUpdate = results[results.length - 1] as { count: number };
  return runUpdate.count > 0;
}

/**
 * Claims an item for grading, at most once. Claim-then-grade (rather than
 * grade-then-mark) means a crash mid-submit loses at most one review event -
 * the item just stays uncovered - instead of writing a duplicate into an
 * append-only log and double-crediting litres and altitude on retry.
 */
export async function claimForGrading(itemId: string, at: Date): Promise<boolean> {
  const result = await prisma.examRunItem.updateMany({
    where: { id: itemId, gradedAt: null },
    data: { gradedAt: at },
  });

  return result.count > 0;
}

/** Topic/module names for the results screen's "where did this come from" line. */
export async function findItemSources(
  knowledgeItemIds: string[],
): Promise<Map<string, { topicName: string; moduleName: string }>> {
  if (knowledgeItemIds.length === 0) return new Map();

  const items = await prisma.knowledgeItem.findMany({
    where: { id: { in: knowledgeItemIds } },
    select: {
      id: true,
      objective: { select: { topic: { select: { name: true, module: { select: { name: true } } } } } },
    },
  });

  return new Map(
    items.map((item) => [
      item.id,
      { topicName: item.objective.topic.name, moduleName: item.objective.topic.module.name },
    ]),
  );
}
