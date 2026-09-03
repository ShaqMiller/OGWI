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

export interface KnowledgeItemPrompt {
  knowledgeItemId: string;
  format: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
}

/**
 * Reads the BASE rendering's content for display. Seed content is always
 * MULTIPLE_CHOICE right now, so this assumes that shape rather than
 * branching on format - broaden this once other formats exist.
 */
export async function findKnowledgeItemPrompt(
  knowledgeItemId: string,
): Promise<KnowledgeItemPrompt | null> {
  const rendering = await prisma.rendering.findFirst({
    where: { knowledgeItemId, role: 'BASE' },
  });

  if (!rendering) return null;

  const content = rendering.content as {
    prompt?: string;
    options?: string[];
    correctOptionIndex?: number;
  };

  return {
    knowledgeItemId,
    format: rendering.format,
    prompt: content.prompt ?? '',
    options: content.options ?? [],
    correctOptionIndex: content.correctOptionIndex ?? -1,
  };
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
