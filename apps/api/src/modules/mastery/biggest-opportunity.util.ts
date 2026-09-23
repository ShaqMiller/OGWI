/**
 * The Biggest Opportunity (Doc 2 B1): "drag = blueprint weight x max(0, pass
 * mark - displayed mastery); the maximum wins; ties break to the heavier
 * weight." It reads DISPLAYED mastery on purpose - the spec's honesty split
 * has the displayed value drive "labels, the trend and Biggest Opportunity".
 * It is a pointer to where effort pays most, not a prediction, so reading the
 * published layer doesn't break invariant 5.
 *
 * Pure: the caller supplies modules with their displayed scores.
 */

export interface ModuleForOpportunity {
  moduleId: string;
  moduleName: string;
  blueprintWeight: number;
  displayedScore: number;
}

export interface BiggestOpportunity {
  moduleId: string;
  moduleName: string;
  blueprintWeight: number;
  displayedScore: number;
  drag: number;
}

export function pickBiggestOpportunity(
  modules: ModuleForOpportunity[],
  passMark: number,
): BiggestOpportunity | null {
  // Drags are products of fractions, so a tie on paper (0.1 x 0.4 vs 0.2 x
  // 0.2) differs in the last floating-point bit. Compare with a tolerance.
  const EPSILON = 1e-12;
  let best: BiggestOpportunity | null = null;

  for (const module of modules) {
    const drag = module.blueprintWeight * Math.max(0, passMark - module.displayedScore);
    if (drag <= EPSILON) continue;

    const wins =
      best === null ||
      drag > best.drag + EPSILON ||
      (Math.abs(drag - best.drag) <= EPSILON && module.blueprintWeight > best.blueprintWeight);

    if (wins) {
      best = {
        moduleId: module.moduleId,
        moduleName: module.moduleName,
        blueprintWeight: module.blueprintWeight,
        displayedScore: module.displayedScore,
        drag,
      };
    }
  }

  return best;
}
