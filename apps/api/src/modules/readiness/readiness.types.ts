import type { NextAction, ReadinessBreakdown, UnlockChecklist } from '@ogwi/shared';

export type CertaintyBand = 'early' | 'fair' | 'solid';

export interface ReadinessResult {
  oddsPercent: number | null;
  withheld: boolean;
  weightedCoveragePercent: number;
  certaintyBand: CertaintyBand;
  passMarkPercent: number;
  qualityRatio: number;
  celebrationEligible: boolean;
  forecast: {
    expectedFinishDate: string | null;
    itemsRemaining: number;
    paceItemsPerDay: number;
    frozen: boolean;
  };
  nextAction: NextAction | null;
  breakdown: ReadinessBreakdown;
}

export interface PublishedReadiness extends ReadinessResult {
  unlocked: boolean;
  firstScore: boolean;
  celebrate: boolean;
  publishedAt: Date;
}

export interface ReadinessView {
  checklist: UnlockChecklist;
  published: PublishedReadiness | null;
}
