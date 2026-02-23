import { z } from 'zod';

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const userResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
