'use client';

import { useKnowledgeItemPrompt } from '@/hooks/content-graph/useKnowledgeItemPrompt';

const MAX_LENGTH = 60;

/** A question's prompt, shortened, so dev tables name questions rather than uuids. */
export function ItemLabel({ knowledgeItemId }: { knowledgeItemId: string }) {
  const prompt = useKnowledgeItemPrompt(knowledgeItemId);
  const text = prompt.data?.prompt ?? knowledgeItemId.slice(0, 8);

  return (
    <span title={text}>{text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 3)}...` : text}</span>
  );
}
