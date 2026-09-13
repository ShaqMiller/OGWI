import {
  GAP_QUIZ_MAX_WAIT_DAYS,
  GAP_QUIZ_MIN_ITEMS,
  GAP_QUIZ_READY_LEAD_DAYS,
  WRONG_ANSWER_POOL_RETEST_WINDOW_DAYS,
  type GapQueueModule,
  type RemediationItem,
} from '@ogwi/shared';
import * as clock from '../../lib/clock.js';
import * as contentGraphService from '../content-graph/content-graph.service.js';
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
    rows.push({
      knowledgeItemId,
      moduleId: first.moduleId,
      moduleName: first.moduleName,
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
