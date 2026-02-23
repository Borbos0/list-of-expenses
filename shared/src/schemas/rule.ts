import { z } from 'zod';

export const matchTypeSchema = z.enum(['contains', 'startsWith', 'regex', 'equals']);

export const ruleSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  match_type: matchTypeSchema,
  pattern: z.string(),
  mcc: z.string().nullable(),
  bank_category_raw: z.string().nullable(),
  amount_sign: z.enum(['positive', 'negative']).nullable(),
  action_type: z.string(),
  action_category_id: z.number().nullable(),
  action_set_type: z.enum(['expense', 'income', 'transfer', 'ignore']).nullable(),
  created_at: z.string(),
  priority: z.number(),
});

export const createRuleSchema = z.object({
  match_type: matchTypeSchema,
  pattern: z.string().min(1),
  mcc: z.string().nullable().optional().default(null),
  bank_category_raw: z.string().nullable().optional().default(null),
  amount_sign: z.enum(['positive', 'negative']).nullable().optional().default(null),
  action_type: z.string().default('categorize'),
  action_category_id: z.number().nullable().optional().default(null),
  action_set_type: z.enum(['expense', 'income', 'transfer', 'ignore']).nullable().optional().default(null),
  priority: z.number().int().default(0),
});

export const updateRuleSchema = createRuleSchema.partial();

export type MatchType = z.infer<typeof matchTypeSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type CreateRule = z.infer<typeof createRuleSchema>;
export type UpdateRule = z.infer<typeof updateRuleSchema>;
