import { z } from 'zod';

export const statsQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const timeseriesQuerySchema = statsQuerySchema.extend({
  group: z.enum(['day', 'week', 'month']).default('month'),
  type: z.enum(['expense', 'income', 'both']).default('both'),
  category_id: z.coerce.number().optional(),
});

export const byCategoryQuerySchema = statsQuerySchema.extend({
  type: z.enum(['expense', 'income']).default('expense'),
});

export const summaryResponseSchema = z.object({
  total_income: z.number(),
  total_expense: z.number(),
  net: z.number(),
  transaction_count: z.number(),
  last_transaction_date: z.string().nullable(),
});

export const timeseriesPointSchema = z.object({
  period: z.string(),
  income: z.number(),
  expense: z.number(),
});

export const categoryBreakdownSchema = z.object({
  category_id: z.number().nullable(),
  category_name: z.string(),
  total: z.number(),
  percentage: z.number(),
  transaction_count: z.number(),
});

export type StatsQuery = z.infer<typeof statsQuerySchema>;
export type TimeseriesQuery = z.infer<typeof timeseriesQuerySchema>;
export type ByCategoryQuery = z.infer<typeof byCategoryQuerySchema>;
export type SummaryResponse = z.infer<typeof summaryResponseSchema>;
export type TimeseriesPoint = z.infer<typeof timeseriesPointSchema>;
export type CategoryBreakdown = z.infer<typeof categoryBreakdownSchema>;
