import { z } from 'zod';
import { adStatusSchema, marketplaceCodeSchema } from '../marketplace';
import { moneySchema } from './common';

/** Command payload to create an ad (draft). */
export const createAdSchema = z.object({
  marketplace: marketplaceCodeSchema,
  title: z.string().min(3).max(120),
  categoryId: z.string(),
  subcategoryId: z.string().nullable().default(null),
  regionId: z.string(),
  cityId: z.string(),
  price: moneySchema,
  description: z.string().max(10_000).default(''),
});
export type CreateAdDto = z.infer<typeof createAdSchema>;

export const changePriceSchema = z.object({
  price: moneySchema,
  reason: z.string().max(280).nullable().default(null),
});
export type ChangePriceDto = z.infer<typeof changePriceSchema>;

/**
 * The `ad` read-model as served to the UI. This is a *projection* built from events —
 * never the source of truth. Every metric here is derived from the event stream.
 */
export const adReadModelSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  marketplace: marketplaceCodeSchema,
  externalId: z.string().nullable(),
  status: adStatusSchema,
  title: z.string(),
  categoryId: z.string(),
  subcategoryId: z.string().nullable(),
  regionId: z.string(),
  cityId: z.string(),
  price: moneySchema,
  aiScore: z.number().min(0).max(100).nullable(),
  // Derived performance metrics (rolled up by projections)
  metrics: z.object({
    views: z.number().int().nonnegative(),
    viewsLast24h: z.number().int().nonnegative(),
    favorites: z.number().int().nonnegative(),
    contacts: z.number().int().nonnegative(),
    messages: z.number().int().nonnegative(),
    ctr: z.number().min(0).max(1),
    conversion: z.number().min(0).max(1),
    spend: moneySchema,
    revenue: moneySchema,
    roi: z.number(),
    costPerContact: z.number().nonnegative(),
    costPerView: z.number().nonnegative(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdReadModel = z.infer<typeof adReadModelSchema>;
