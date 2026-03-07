import { z } from 'zod';

export const transactionTypeSchema = z.enum(['expense', 'income', 'transfer', 'ignore']);

export const transactionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  date_time: z.string(),
  type: transactionTypeSchema,
  amount_kopeks: z.number().int(),
  category_id: z.number().nullable(),
  description: z.string().nullable(),
  merchant_norm: z.string().nullable(),
  mcc: z.string().nullable(),
  bank_category_raw: z.string().nullable(),
  import_batch_id: z.number().nullable(),
  fingerprint: z.string().nullable(),
  tags: z.string().nullable(),
  cashback_kopeks: z.number().int().default(0),
  // joined fields
  category_name: z.string().nullable().optional(),
  from_tag: z.string().nullable().optional(),
  to_tag: z.string().nullable().optional(),
});

export const createTransactionSchema = z.object({
  date_time: z.string().min(1),
  type: transactionTypeSchema,
  amount_kopeks: z.number().int(),
  category_id: z.number().nullable().optional().default(null),
  description: z.string().optional().default(''),
  merchant_norm: z.string().optional(),
  tags: z.string().optional(),
  from_tag: z.string().optional(),
  to_tag: z.string().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: transactionTypeSchema.optional(),
  category_id: z.coerce.number().optional(),
  search: z.string().optional(),
  has_cashback: z.coerce.boolean().optional(),
  no_category: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type TransactionFilter = z.infer<typeof transactionFilterSchema>;
