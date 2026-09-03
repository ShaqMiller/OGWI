/**
 * Build-time validation gate values for the content graph (Doc 2 B10 / A1).
 * These are reference defaults carried over from the handover docs, not
 * enforced anywhere yet - treat them as a starting point to revisit, not law.
 */
export const CONTENT_GRAPH_GATES = {
  MIN_ITEMS_PER_TOPIC: 5,
  MAX_ITEMS_PER_TOPIC: 10,
  MIN_KEY_POINTS_PER_TOPIC: 8,
  MAX_KEY_POINTS_PER_TOPIC: 20,
  MIN_RENDERINGS_PER_ITEM: 3,
} as const;
