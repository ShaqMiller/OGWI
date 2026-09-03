/**
 * The single place query keys are constructed. Nothing else builds a key
 * inline - hooks import from here so invalidation can be surgical
 * (invalidate one qualification) or broad (invalidate everything under
 * contentGraph) without hunting through components for string literals.
 *
 * Keys are hierarchical: a broader key is always a prefix of its children,
 * which is what makes queryClient.invalidateQueries({ queryKey }) work at
 * any granularity.
 */
export const queryKeys = {
  contentGraph: {
    all: () => ['contentGraph'] as const,
    qualifications: () => [...queryKeys.contentGraph.all(), 'qualifications'] as const,
    qualification: (slug: string) => [...queryKeys.contentGraph.qualifications(), slug] as const,
    knowledgeItem: (id: string) => [...queryKeys.contentGraph.all(), 'knowledgeItem', id] as const,
  },
  mastery: {
    all: () => ['mastery'] as const,
    qualification: (slug: string) => [...queryKeys.mastery.all(), slug] as const,
  },
  composition: {
    all: () => ['composition'] as const,
    next: (slug: string) => [...queryKeys.composition.all(), 'next', slug] as const,
  },
  economy: {
    all: () => ['economy'] as const,
    balance: (slug: string) => [...queryKeys.economy.all(), 'balance', slug] as const,
    recent: (slug: string) => [...queryKeys.economy.all(), 'recent', slug] as const,
  },
  scheduler: {
    all: () => ['scheduler'] as const,
    due: (slug: string) => [...queryKeys.scheduler.all(), 'due', slug] as const,
  },
  adaptive: {
    all: () => ['adaptive'] as const,
    wrongAnswerPool: (slug: string) => [...queryKeys.adaptive.all(), 'wrongAnswerPool', slug] as const,
  },
  flight: {
    all: () => ['flight'] as const,
    state: (slug: string) => [...queryKeys.flight.all(), 'state', slug] as const,
    // Awards are learner-global, not per-qualification - no slug argument.
    awards: () => [...queryKeys.flight.all(), 'awards'] as const,
  },
  readiness: {
    all: () => ['readiness'] as const,
    qualification: (slug: string) => [...queryKeys.readiness.all(), slug] as const,
  },
  recall: {
    all: () => ['recall'] as const,
    keyPoints: (topicId: string) => [...queryKeys.recall.all(), 'keyPoints', topicId] as const,
  },
  exam: {
    all: () => ['exam'] as const,
    run: (runId: string) => [...queryKeys.exam.all(), 'run', runId] as const,
    results: (runId: string) => [...queryKeys.exam.all(), 'results', runId] as const,
  },
} as const;
