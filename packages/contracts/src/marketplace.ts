import { z } from 'zod';

/**
 * Every integrable marketplace / channel. New adapters register under one of these codes.
 * The platform must never hardcode logic for a single value here.
 */
export const MarketplaceCode = {
  AVITO: 'avito',
  YULA: 'yula',
  TELEGRAM: 'telegram',
  VK: 'vk',
  OZON: 'ozon',
  WILDBERRIES: 'wildberries',
  YANDEX_MARKET: 'yandex_market',
  DROM: 'drom',
  AUTO_RU: 'auto_ru',
  CIAN: 'cian',
  MAX: 'max',
} as const;

export type MarketplaceCode = (typeof MarketplaceCode)[keyof typeof MarketplaceCode];

export const marketplaceCodeSchema = z.enum([
  MarketplaceCode.AVITO,
  MarketplaceCode.YULA,
  MarketplaceCode.TELEGRAM,
  MarketplaceCode.VK,
  MarketplaceCode.OZON,
  MarketplaceCode.WILDBERRIES,
  MarketplaceCode.YANDEX_MARKET,
  MarketplaceCode.DROM,
  MarketplaceCode.AUTO_RU,
  MarketplaceCode.CIAN,
  MarketplaceCode.MAX,
]);

export interface MarketplaceMeta {
  code: MarketplaceCode;
  label: string;
  /** Whether the adapter supports two-way messaging. */
  messaging: boolean;
  /** Whether the adapter exposes paid promotions (VIP/XL/Premium equivalents). */
  promotions: boolean;
}

export const MARKETPLACES: Record<MarketplaceCode, MarketplaceMeta> = {
  [MarketplaceCode.AVITO]: { code: MarketplaceCode.AVITO, label: 'Авито', messaging: true, promotions: true },
  [MarketplaceCode.YULA]: { code: MarketplaceCode.YULA, label: 'Юла', messaging: true, promotions: true },
  [MarketplaceCode.TELEGRAM]: { code: MarketplaceCode.TELEGRAM, label: 'Telegram', messaging: true, promotions: false },
  [MarketplaceCode.VK]: { code: MarketplaceCode.VK, label: 'VK', messaging: true, promotions: true },
  [MarketplaceCode.OZON]: { code: MarketplaceCode.OZON, label: 'Ozon', messaging: true, promotions: true },
  [MarketplaceCode.WILDBERRIES]: { code: MarketplaceCode.WILDBERRIES, label: 'Wildberries', messaging: false, promotions: true },
  [MarketplaceCode.YANDEX_MARKET]: { code: MarketplaceCode.YANDEX_MARKET, label: 'Яндекс Маркет', messaging: true, promotions: true },
  [MarketplaceCode.DROM]: { code: MarketplaceCode.DROM, label: 'Drom', messaging: true, promotions: true },
  [MarketplaceCode.AUTO_RU]: { code: MarketplaceCode.AUTO_RU, label: 'Auto.ru', messaging: true, promotions: true },
  [MarketplaceCode.CIAN]: { code: MarketplaceCode.CIAN, label: 'ЦИАН', messaging: true, promotions: true },
  [MarketplaceCode.MAX]: { code: MarketplaceCode.MAX, label: 'MAX', messaging: true, promotions: false },
};

/** Canonical promotion kinds, normalized across marketplaces. */
export const PromotionKind = {
  VIP: 'vip',
  XL: 'xl',
  PREMIUM: 'premium',
  HIGHLIGHT: 'highlight',
  BOOST: 'boost',
} as const;
export type PromotionKind = (typeof PromotionKind)[keyof typeof PromotionKind];

/** Canonical ad lifecycle status, normalized across marketplaces. */
export const AdStatus = {
  DRAFT: 'draft',
  MODERATION: 'moderation',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
  SOLD: 'sold',
  EXPIRED: 'expired',
} as const;
export type AdStatus = (typeof AdStatus)[keyof typeof AdStatus];

export const adStatusSchema = z.nativeEnum(AdStatus);
export const promotionKindSchema = z.nativeEnum(PromotionKind);
