import { z } from 'zod';

export const createSessionSchema = z.object({
  context: z.record(z.unknown()).optional(),
});

export const postMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2000),
  /** Explicit user confirmation gate for sensitive tools (e.g. payment prep). */
  confirmed: z.boolean().optional().default(false),
});

export const sessionIdSchema = z.object({
  id: z.string().uuid('Invalid session id'),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type PostMessageInput = z.infer<typeof postMessageSchema>;
