import type { KnowledgeItemPrompt, RenderingFormat } from '@ogwi/shared';
import type { Module as PrismaModule, Qualification as PrismaQualification } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { QualificationWithModules } from './content-graph.types.js';

/**
 * The only layer in this module allowed to import the Prisma client.
 * Everything it returns is a domain type (packages/shared shapes), never a
 * raw Prisma model - controllers and services must not know Prisma exists.
 */

function toDomainModule(row: PrismaModule): QualificationWithModules['modules'][number] {
  return {
    id: row.id,
    qualificationId: row.qualificationId,
    name: row.name,
    order: row.order,
    blueprintWeight: Number(row.blueprintWeight),
  };
}

function toDomainQualification(
  row: PrismaQualification & { modules: PrismaModule[] },
): QualificationWithModules {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    contentGraphVersion: row.contentGraphVersion,
    createdAt: row.createdAt,
    passMark: Number(row.passMark),
    modules: row.modules.map(toDomainModule).sort((a, b) => a.order - b.order),
  };
}

export async function findQualificationBySlug(
  slug: string,
): Promise<QualificationWithModules | null> {
  const row = await prisma.qualification.findUnique({
    where: { slug },
    include: { modules: true },
  });

  return row ? toDomainQualification(row) : null;
}

export async function listQualifications(): Promise<QualificationWithModules[]> {
  const rows = await prisma.qualification.findMany({
    include: { modules: true },
    orderBy: { name: 'asc' },
  });

  return rows.map(toDomainQualification);
}

/**
 * Reads the BASE rendering for display. Deliberately returns no correct
 * answer - see knowledgeItemPromptSchema in packages/shared for why.
 *
 * The `?? ''` / `?? []` defaults this used to apply are gone: malformed
 * content is now surfaced by the answer checker rather than papered over
 * into an unanswerable question. Display still tolerates a missing prompt
 * or options (you get an empty question, not a crash); grading does not.
 *
 * `orderBy` matters even though every item currently has exactly one BASE
 * rendering: without it, a second BASE would make this return an arbitrary
 * row per call, and the learner could be graded against a rendering other
 * than the one they were shown.
 */
export async function findKnowledgeItemPrompt(
  knowledgeItemId: string,
): Promise<KnowledgeItemPrompt | null> {
  const rendering = await prisma.rendering.findFirst({
    where: { knowledgeItemId, role: 'BASE' },
    orderBy: { createdAt: 'asc' },
  });

  if (!rendering) return null;

  const content = rendering.content as { prompt?: string; options?: string[] };

  return {
    knowledgeItemId,
    renderingId: rendering.id,
    format: rendering.format,
    prompt: content.prompt ?? '',
    options: content.options ?? [],
  };
}

export interface GradableRendering {
  renderingId: string;
  format: RenderingFormat;
  content: unknown;
}

/**
 * Loads the rendering a learner claims to have answered.
 *
 * Both ids are scoped in the `where` clause rather than compared afterwards,
 * so a caller cannot forget the ownership check: passing a renderingId that
 * belongs to a different knowledge item simply finds nothing. That also
 * means "no such rendering" and "not yours" are indistinguishable to the
 * client, which is intentional - no enumeration oracle.
 */
export async function findGradableRendering(
  knowledgeItemId: string,
  renderingId: string,
): Promise<GradableRendering | null> {
  const rendering = await prisma.rendering.findFirst({
    where: { id: renderingId, knowledgeItemId },
  });

  if (!rendering) return null;

  return {
    renderingId: rendering.id,
    format: rendering.format,
    content: rendering.content,
  };
}

/**
 * Bulk form of findGradableRendering, keyed by renderingId. Each pair is
 * scoped by BOTH ids in the same way, so a rendering that doesn't belong to
 * its claimed item simply isn't in the returned map - the ownership check
 * can't be skipped by using this instead of the single-row version.
 */
export async function findGradableRenderings(
  pairs: { knowledgeItemId: string; renderingId: string }[],
): Promise<Map<string, GradableRendering>> {
  if (pairs.length === 0) return new Map();

  const rows = await prisma.rendering.findMany({
    where: {
      OR: pairs.map(({ knowledgeItemId, renderingId }) => ({ id: renderingId, knowledgeItemId })),
    },
  });

  return new Map(
    rows.map((row) => [
      row.id,
      { renderingId: row.id, format: row.format, content: row.content },
    ]),
  );
}

/**
 * How many renderings each of these items has. Used by the adaptive engine
 * to decide whether the "two different renderings" remediation exit rule can
 * apply at all - enforcing it on a single-rendering item would make exit
 * impossible. One grouped query, not one per item.
 */
export async function countRenderingsByItem(
  knowledgeItemIds: string[],
): Promise<Map<string, number>> {
  if (knowledgeItemIds.length === 0) return new Map();

  const rows = await prisma.rendering.groupBy({
    by: ['knowledgeItemId'],
    where: { knowledgeItemId: { in: knowledgeItemIds } },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.knowledgeItemId, row._count._all]));
}

/** Cheap join used by other modules (scheduler -> flight) to resolve which qualification a graded item belongs to. */
export async function findQualificationIdForKnowledgeItem(
  knowledgeItemId: string,
): Promise<string | null> {
  const item = await prisma.knowledgeItem.findUnique({
    where: { id: knowledgeItemId },
    select: { objective: { select: { topic: { select: { module: { select: { qualificationId: true } } } } } } },
  });

  return item?.objective.topic.module.qualificationId ?? null;
}
