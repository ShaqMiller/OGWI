import { z } from 'zod';

export const economyBalanceSchema = z.object({
  totalPoints: z.number().int().nonnegative(),
});
export type EconomyBalance = z.infer<typeof economyBalanceSchema>;

export const economyEventSchema = z.object({
  amount: z.number().int().nonnegative(),
  source: z.string(),
  knowledgeItemId: z.string().uuid().nullable(),
  effectiveAt: z.coerce.date(),
});
export type EconomyEvent = z.infer<typeof economyEventSchema>;
