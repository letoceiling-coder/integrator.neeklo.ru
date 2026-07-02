import { z } from 'zod';

/** Cursor-based pagination — the only pagination that scales to 100k+ ads. */
export const pageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function pageResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative().optional(),
  });
}
export type PageResponse<T> = { items: T[]; nextCursor: string | null; total?: number };

export const moneySchema = z.object({
  amount: z.number().int(),
  currency: z.string().default('RUB'),
});
export type Money = z.infer<typeof moneySchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  correlationId: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
