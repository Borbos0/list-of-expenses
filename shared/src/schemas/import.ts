import { z } from 'zod';

export const importBatchSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  source_name: z.string().nullable(),
  created_at: z.string(),
  rows_total: z.number(),
  rows_imported: z.number(),
  rows_skipped: z.number(),
  rows_need_review: z.number(),
});

export const columnMappingSchema = z.object({
  date_time: z.string(),
  amount: z.string(),
  description: z.string().optional(),
  merchant: z.string().optional(),
  mcc: z.string().optional(),
  bank_category: z.string().optional(),
  extra_amount: z.string().optional(),
  operation_type: z.string().optional(),
  cashback: z.string().optional(),
});

export const reviewDecisionSchema = z.object({
  row_index: z.number(),
  action: z.enum(['approve', 'skip', 'recategorize']),
  category_id: z.number().optional(),
  type: z.enum(['expense', 'income', 'transfer', 'ignore']).optional(),
  from_tag: z.string().optional(),
  to_tag: z.string().optional(),
  create_rule: z.boolean().optional().default(false),
});

export const processedRowSchema = z.object({
  row_index: z.number(),
  raw: z.record(z.string()),
  date_time: z.string(),
  amount_kopeks: z.number(),
  description: z.string(),
  merchant_norm: z.string().nullable(),
  mcc: z.string().nullable(),
  bank_category_raw: z.string().nullable(),
  extra_amount_kopeks: z.number().default(0),
  cashback_kopeks: z.number().default(0),
  auto_type: z.enum(['expense', 'income', 'transfer', 'ignore']).nullable(),
  auto_category_id: z.number().nullable(),
  auto_category_name: z.string().nullable(),
  status: z.enum(['auto_classified', 'need_review', 'duplicate', 'skipped']),
  fingerprint: z.string(),
  from_tag: z.string().nullable().optional(),
  to_tag: z.string().nullable().optional(),
  review_reason: z.string().nullable().optional(),
});

export type ImportBatch = z.infer<typeof importBatchSchema>;
export type ColumnMapping = z.infer<typeof columnMappingSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type ProcessedRow = z.infer<typeof processedRowSchema>;
