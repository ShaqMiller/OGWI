import { describe, expect, it } from 'vitest';
import {
  allocatePaper,
  buildPaperOrder,
  type ModulePaperInput,
} from '../paper-blueprint.util.js';

/**
 * The seeded content has one module at weight 1.0, so apportionment and
 * shortfall redistribution are unreachable from the database. These are the
 * only place that behaviour is exercised at all.
 */

/** Deterministic rng so a paper is reproducible from a seed. */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function mod(
  moduleId: string,
  order: number,
  blueprintWeight: number,
  itemCount: number,
): ModulePaperInput {
  return {
    moduleId,
    order,
    blueprintWeight,
    eligibleItemIds: Array.from({ length: itemCount }, (_, i) => `${moduleId}-item-${i}`),
  };
}

const sizes = (allocations: { knowledgeItemIds: string[] }[]) =>
  allocations.map((allocation) => allocation.knowledgeItemIds.length);

describe('allocatePaper', () => {
  it('splits exactly when the weights divide the target evenly', () => {
    const modules = [mod('a', 0, 0.5, 20), mod('b', 1, 0.3, 20), mod('c', 2, 0.2, 20)];

    expect(sizes(allocatePaper(modules, 10, seededRng(1)))).toEqual([5, 3, 2]);
  });

  it('gives leftover seats to the largest remainders, breaking ties by module order', () => {
    // 7 seats at 0.5/0.3/0.2 -> raw 3.5/2.1/1.4, bases 3/2/1, 1 seat left
    // -> largest remainder is 'a' (0.5).
    const modules = [mod('a', 0, 0.5, 20), mod('b', 1, 0.3, 20), mod('c', 2, 0.2, 20)];

    expect(sizes(allocatePaper(modules, 7, seededRng(1)))).toEqual([4, 2, 1]);
  });

  it('normalises weights that do not sum to 1', () => {
    const modules = [mod('a', 0, 0.6, 20), mod('b', 1, 0.6, 20)];

    expect(sizes(allocatePaper(modules, 10, seededRng(1)))).toEqual([5, 5]);
  });

  it('splits equally when every weight is zero', () => {
    const modules = [mod('a', 0, 0, 20), mod('b', 1, 0, 20), mod('c', 2, 0, 20)];

    expect(sizes(allocatePaper(modules, 9, seededRng(1)))).toEqual([3, 3, 3]);
  });

  it('redistributes a thin module’s shortfall to the modules with headroom', () => {
    // 'a' is owed 6 of 12 but only holds 2, so 4 seats move to b and c.
    const modules = [mod('a', 0, 0.5, 2), mod('b', 1, 0.25, 20), mod('c', 2, 0.25, 20)];
    const allocations = allocatePaper(modules, 12, seededRng(1));

    expect(sizes(allocations)).toEqual([2, 5, 5]);
    expect(sizes(allocations).reduce((sum, n) => sum + n, 0)).toBe(12);
  });

  it('caps the paper at the total eligible content and uses every item once', () => {
    const modules = [mod('a', 0, 0.5, 3), mod('b', 1, 0.5, 2)];
    const allocations = allocatePaper(modules, 30, seededRng(1));

    const ids = allocations.flatMap((allocation) => allocation.knowledgeItemIds);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it('never repeats an item, and draws each from its own module', () => {
    const modules = [mod('a', 0, 0.5, 20), mod('b', 1, 0.5, 20)];
    const allocations = allocatePaper(modules, 20, seededRng(7));

    const ids = allocations.flatMap((allocation) => allocation.knowledgeItemIds);
    expect(new Set(ids).size).toBe(ids.length);
    for (const allocation of allocations) {
      for (const id of allocation.knowledgeItemIds) {
        expect(id.startsWith(`${allocation.moduleId}-`)).toBe(true);
      }
    }
  });

  it('handles the seeded shape - one module, capped by its item count', () => {
    // demo-cert: a single module at weight 1.0 holding 8 items.
    const allocations = allocatePaper([mod('only', 0, 1, 8)], 30, seededRng(1));

    expect(sizes(allocations)).toEqual([8]);
  });

  it('returns nothing when there is no eligible content', () => {
    const allocations = allocatePaper([mod('a', 0, 1, 0)], 30, seededRng(1));

    expect(allocations.flatMap((a) => a.knowledgeItemIds)).toEqual([]);
  });

  it('is deterministic for a seed, and actually consumes the rng', () => {
    const modules = [mod('a', 0, 0.5, 20), mod('b', 1, 0.5, 20)];

    const first = allocatePaper(modules, 10, seededRng(42));
    const same = allocatePaper(modules, 10, seededRng(42));
    const different = allocatePaper(modules, 10, seededRng(99));

    expect(first).toEqual(same);
    // Guards against an rng that is accepted but never used - which would
    // make every "randomised" paper identical.
    expect(different).not.toEqual(first);
  });
});

describe('buildPaperOrder', () => {
  it('flattens every allocated item exactly once', () => {
    const allocations = [
      { moduleId: 'a', knowledgeItemIds: ['a1', 'a2', 'a3'] },
      { moduleId: 'b', knowledgeItemIds: ['b1', 'b2'] },
    ];

    const order = buildPaperOrder(allocations, seededRng(3));

    expect(order).toHaveLength(5);
    expect(new Set(order.map((q) => q.knowledgeItemId)).size).toBe(5);
    expect(order.find((q) => q.knowledgeItemId === 'b1')?.moduleId).toBe('b');
  });

  it('interleaves modules rather than serving them in blocks', () => {
    // Position must not telegraph the blueprint.
    const allocations = [
      { moduleId: 'a', knowledgeItemIds: Array.from({ length: 10 }, (_, i) => `a${i}`) },
      { moduleId: 'b', knowledgeItemIds: Array.from({ length: 10 }, (_, i) => `b${i}`) },
    ];

    const order = buildPaperOrder(allocations, seededRng(5));
    const blocked = order.slice(0, 10).every((q) => q.moduleId === 'a');

    expect(blocked).toBe(false);
  });
});
