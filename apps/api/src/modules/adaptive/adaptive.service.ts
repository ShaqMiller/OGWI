import {
  GAP_QUIZ_MAX_WAIT_DAYS,
  GAP_QUIZ_MIN_ITEMS,
  GAP_QUIZ_READY_LEAD_DAYS,
  REMEDIATION_EXIT_CORRECT_COUNT,
  WRONG_ANSWER_POOL_RETEST_WINDOW_DAYS,
  type GapQueueModule,
  type RemediationRecord,
  type RemediationItem,
} from '@ogwi/shared';
import * as clock from '../../lib/clock.js';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import { actSource } from '../scheduler/idempotency.util.js';
import * as adaptiveRepository from './adaptive.repository.js';
import { deriveRemediationState } from './remediation.util.js';
import type { ItemRemediationRow } from './adaptive.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 */

async function getRemediationRows(
  learnerId: string,
  qualificationId: string,
): Promise<ItemRemediationRow[]> {
  const events = await adaptiveRepository.findReviewEventsForQualification(
    learnerId,
    qualificationId,
  );

  const byItem = new Map<string, adaptiveRepository.ReviewEventWithModule[]>();
  for (const event of events) {
    const group = byItem.get(event.knowledgeItemId) ?? [];
    group.push(event);
    byItem.set(event.knowledgeItemId, group);
  }

  // The spec's "two different renderings" exit rule only makes sense for an
  // item that has more than one rendering to serve; on single-rendering
  // content it would block exit permanently. One grouped query for the whole
  // set, not one per item. See remediation.util.ts for the full reasoning.
  const renderingCounts = await contentGraphService.countRenderingsByItem(
    Array.from(byItem.keys()),
  );

  const rows: ItemRemediationRow[] = [];
  for (const [knowledgeItemId, itemEvents] of byItem) {
    const state = deriveRemediationState(itemEvents, {
      enforceRenderingDistinctness: (renderingCounts.get(knowledgeItemId) ?? 0) > 1,
    });
    if (state.enteredAt === null) continue; // never entered remediation - nothing to report

    const first = itemEvents[0]!;
    const latestAgain = [...itemEvents].reverse().find((event) => event.grade === 'AGAIN');
    rows.push({
      knowledgeItemId,
      moduleId: first.moduleId,
      moduleName: first.moduleName,
      source: actSource(latestAgain?.idempotencyKey ?? null),
      ...state,
    });
  }

  return rows;
}

export async function getWrongAnswerPool(
  learnerId: string,
  qualificationId: string,
): Promise<RemediationItem[]> {
  const rows = await getRemediationRows(learnerId, qualificationId);
  const now = clock.now().getTime();
  const retestWindowMs = WRONG_ANSWER_POOL_RETEST_WINDOW_DAYS * DAY_MS;

  return rows
    .filter(
      (row) =>
        row.inRemediation ||
        (row.exitedAt !== null && now - row.exitedAt.getTime() <= retestWindowMs),
    )
    .map((row) => ({
      knowledgeItemId: row.knowledgeItemId,
      moduleId: row.moduleId,
      moduleName: row.moduleName,
      status: row.inRemediation ? 'in_remediation' : 'recently_exited',
      enteredAt: row.enteredAt as Date,
      exitedAt: row.exitedAt,
    }));
}

export async function getGapQueue(
  learnerId: string,
  qualificationId: string,
): Promise<GapQueueModule[]> {
  const rows = (await getRemediationRows(learnerId, qualificationId)).filter(
    (row) => row.inRemediation,
  );

  const byModule = new Map<string, ItemRemediationRow[]>();
  for (const row of rows) {
    const group = byModule.get(row.moduleId) ?? [];
    group.push(row);
    byModule.set(row.moduleId, group);
  }

  const now = clock.now();

  return Array.from(byModule.entries()).map(([moduleId, moduleRows]) => {
    const oldestSignalAt = moduleRows.reduce<Date | null>((oldest, row) => {
      if (!row.enteredAt) return oldest;
      return !oldest || row.enteredAt < oldest ? row.enteredAt : oldest;
    }, null);

    const oldestAgeDays = oldestSignalAt ? (now.getTime() - oldestSignalAt.getTime()) / DAY_MS : 0;
    const ready = moduleRows.length >= GAP_QUIZ_MIN_ITEMS || oldestAgeDays >= GAP_QUIZ_MAX_WAIT_DAYS;

    return {
      moduleId,
      moduleName: moduleRows[0]!.moduleName,
      remediationCount: moduleRows.length,
      oldestSignalAt,
      ready,
      readyDate: ready ? new Date(now.getTime() + GAP_QUIZ_READY_LEAD_DAYS * DAY_MS) : null,
    };
  });
}

/**
 * The remediation record for every item that has ever entered remediation
 * (Doc 2 B3): where the miss came from, when, and exactly how far the item is
 * through the exit rule. Derived from the review log like everything else here
 * - there is no record table to drift out of step with it.
 *
 * `rung` is always null: the format ladder needs rendering variants, which
 * don't exist yet, and a made-up rung would be worse than an honest gap.
 */
export async function getRemediationRecords(
  learnerId: string,
  qualificationId: string,
): Promise<RemediationRecord[]> {
  const rows = await getRemediationRows(learnerId, qualificationId);

  return rows
    .map((row) => ({
      knowledgeItemId: row.knowledgeItemId,
      moduleId: row.moduleId,
      moduleName: row.moduleName,
      status: row.inRemediation ? ('in_remediation' as const) : ('exited' as const),
      source: row.source,
      enteredAt: row.enteredAt as Date,
      exitedAt: row.exitedAt,
      againCount: row.againCount,
      qualifyingAnswers: row.qualifyingAnswers.map((answer) => ({
        reviewedAt: answer.reviewedAt,
        renderingId: answer.renderingId,
      })),
      correctAnswersRequired: REMEDIATION_EXIT_CORRECT_COUNT,
      correctAnswersNeeded: row.correctAnswersNeeded,
      nextQualifyingFrom: row.nextQualifyingFrom,
      renderingDistinctnessEnforced: row.renderingDistinctnessEnforced,
      rung: null,
    }))
    .sort(
      (a, b) =>
        Number(b.status === 'in_remediation') - Number(a.status === 'in_remediation') ||
        b.enteredAt.getTime() - a.enteredAt.getTime(),
    );
}
