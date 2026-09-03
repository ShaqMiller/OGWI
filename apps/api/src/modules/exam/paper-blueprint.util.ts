/**
 * Builds an exam paper's question set from the qualification's blueprint.
 *
 * Doc 2 A5 asks for "a fresh randomised paper each time" but never says how
 * one is composed, and Doc 2 Part D says unspecified behaviour "must be
 * raised, not invented" - so this was agreed explicitly: sample each module
 * in proportion to its `blueprintWeight` (the awarding body's published share
 * of the exam), randomise within the module, never repeat an item, and cap
 * the whole thing at however much content actually exists.
 *
 * Pure and rng-injected on purpose. The seeded content has a single module at
 * weight 1.0, so apportionment and shortfall redistribution can only ever be
 * exercised by unit tests - they must not need a database to run.
 */

export interface ModulePaperInput {
  moduleId: string;
  /** Tie-break for apportionment, so a paper doesn't depend on the rng for fairness. */
  order: number;
  blueprintWeight: number;
  eligibleItemIds: string[];
}

export interface ModuleAllocation {
  moduleId: string;
  knowledgeItemIds: string[];
}

export interface PaperQuestion {
  moduleId: string;
  knowledgeItemId: string;
}

/** Guards against a pathological input spinning the redistribution loop. */
const MAX_APPORTIONMENT_PASSES = 64;

/**
 * Hare quota / largest remainder. Distributes exactly `seats` across
 * `weights` (which must sum to 1), giving leftover seats to the largest
 * fractional remainders and breaking ties by index - so callers control the
 * tie-break by the order they pass things in.
 */
function largestRemainder(seats: number, weights: number[]): number[] {
  const raw = weights.map((weight) => seats * weight);
  const allocation = raw.map((value) => Math.floor(value));
  let leftover = seats - allocation.reduce((sum, value) => sum + value, 0);

  const byRemainder = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of byRemainder) {
    if (leftover <= 0) break;
    allocation[index] = (allocation[index] as number) + 1;
    leftover -= 1;
  }

  return allocation;
}

/**
 * How many questions each module contributes. A module that can't fill its
 * share (fewer eligible items than its quota) hands the shortfall back, and
 * the remaining modules re-apportion it among themselves by weight - so a
 * thin module shrinks the paper only when nothing else can absorb the slack.
 */
export function allocatePaper(
  modules: ModulePaperInput[],
  targetSize: number,
  rng: () => number,
): ModuleAllocation[] {
  const ordered = [...modules].sort((a, b) => a.order - b.order);
  const capacity = ordered.map((module) => module.eligibleItemIds.length);
  const totalCapacity = capacity.reduce((sum, value) => sum + value, 0);

  // The cap rule: a paper is never bigger than the content behind it.
  let remaining = Math.min(Math.max(targetSize, 0), totalCapacity);
  const allocation = ordered.map(() => 0);

  for (let pass = 0; remaining > 0 && pass < MAX_APPORTIONMENT_PASSES; pass += 1) {
    const activeIndexes = ordered
      .map((_, index) => index)
      .filter((index) => (allocation[index] as number) < (capacity[index] as number));

    if (activeIndexes.length === 0) break;

    const activeWeights = activeIndexes.map((index) =>
      Math.max(0, (ordered[index] as ModulePaperInput).blueprintWeight),
    );
    const weightSum = activeWeights.reduce((sum, value) => sum + value, 0);

    // Weights are non-nullable but may legitimately all be 0.0000; an equal
    // split is the only sane reading of "no module is weighted".
    const normalised =
      weightSum > 0
        ? activeWeights.map((weight) => weight / weightSum)
        : activeWeights.map(() => 1 / activeIndexes.length);

    const desired = largestRemainder(remaining, normalised);

    let assigned = 0;
    activeIndexes.forEach((moduleIndex, activeIndex) => {
      const headroom = (capacity[moduleIndex] as number) - (allocation[moduleIndex] as number);
      const give = Math.min(desired[activeIndex] as number, headroom);
      allocation[moduleIndex] = (allocation[moduleIndex] as number) + give;
      assigned += give;
    });

    if (assigned === 0) break; // no progress possible; stop rather than spin
    remaining -= assigned;
  }

  return ordered.map((module, index) => ({
    moduleId: module.moduleId,
    knowledgeItemIds: sample(module.eligibleItemIds, allocation[index] as number, rng),
  }));
}

/** Partial Fisher-Yates: `count` distinct members, without mutating the input. */
function sample(itemIds: string[], count: number, rng: () => number): string[] {
  const pool = [...itemIds];
  const take = Math.min(count, pool.length);

  for (let i = 0; i < take; i += 1) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const a = pool[i] as string;
    pool[i] = pool[j] as string;
    pool[j] = a;
  }

  return pool.slice(0, take);
}

/**
 * Flattens the per-module allocations into the order questions are asked in.
 * Shuffled so that position never telegraphs module structure - otherwise a
 * paper reads as blocks and the learner can infer the blueprint from it.
 */
export function buildPaperOrder(
  allocations: ModuleAllocation[],
  rng: () => number,
): PaperQuestion[] {
  const flat = allocations.flatMap((allocation) =>
    allocation.knowledgeItemIds.map((knowledgeItemId) => ({
      moduleId: allocation.moduleId,
      knowledgeItemId,
    })),
  );

  for (let i = flat.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = flat[i] as PaperQuestion;
    flat[i] = flat[j] as PaperQuestion;
    flat[j] = a;
  }

  return flat;
}
