import { z } from 'zod';

export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_id: z.number().nullable(),
  include_in_expense_analytics: z.boolean(),
  include_in_income_analytics: z.boolean(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parent_id: z.number().nullable().optional().default(null),
  include_in_expense_analytics: z.boolean().default(true),
  include_in_income_analytics: z.boolean().default(false),
});

export const updateCategorySchema = createCategorySchema.partial();

export type Category = z.infer<typeof categorySchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
