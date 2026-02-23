import { z } from 'zod';

const envSchema = z.object({
  AUTH_USERNAME: z.string().min(1).default('admin'),
  AUTH_PASSWORD: z.string().min(1).default('admin'),
  SESSION_SECRET: z.string().min(1).default('change-me-to-random-string'),
  DB_PATH: z.string().min(1).default('./data/expenses.db'),
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

export const config = envSchema.parse(process.env);

export type Config = z.infer<typeof envSchema>;
