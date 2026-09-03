import {
  GAP_QUIZ_MAX_WAIT_DAYS,
  GAP_QUIZ_MIN_ITEMS,
  GAP_QUIZ_READY_LEAD_DAYS,
  WRONG_ANSWER_POOL_RETEST_WINDOW_DAYS,
  type GapQueueModule,
  type RemediationItem,
} from '@ogwi/shared';
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

  const rows: ItemRemediationRow[] = [];
  for (const [knowledgeItemId, itemEvents] of byItem) {
    const state = deriveRemediationState(itemEvents);
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
  const now = Date.now();
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

  const now = new Date();

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
