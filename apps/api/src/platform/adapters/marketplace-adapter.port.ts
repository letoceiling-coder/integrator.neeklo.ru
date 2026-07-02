import type { MarketplaceCode, PromotionKind } from '@neeklo/contracts';

/** Canonical, marketplace-agnostic inputs/outputs. Adapters translate to/from provider APIs. */

export interface PublishAdInput {
  title: string;
  description: string;
  categoryId: string;
  price: { amount: number; currency: string };
  regionId: string;
  cityId: string;
  photoUrls: string[];
  attributes: Record<string, string | number | boolean>;
}

export interface PublishAdResult {
  externalId: string;
  url: string | null;
}

export interface AdStatsRange {
  from: string; // ISO
  to: string; // ISO
}

export interface AdStatsPoint {
  date: string;
  views: number;
  contacts: number;
  favorites: number;
}

export interface PromotionResult {
  activated: boolean;
  cost: { amount: number; currency: string };
  expiresAt: string | null;
}

export interface OutboundMessage {
  conversationId: string;
  text: string;
  attachments?: string[];
}

/**
 * A normalized inbound event from a marketplace webhook. The adapter maps provider-specific
 * webhook shapes into these so the rest of the platform never learns provider payloads.
 */
export interface NormalizedInbound {
  kind: 'message' | 'view' | 'contact' | 'status' | 'favorite';
  externalAdId?: string;
  conversationId?: string;
  customerId?: string;
  text?: string;
  occurredAt: string;
  raw: unknown;
}

export interface MarketplaceCapabilities {
  messaging: boolean;
  promotions: boolean;
  publishing: boolean;
  stats: boolean;
}

/**
 * The single contract every marketplace integration implements. Adding a new marketplace =
 * implementing this port + registering it. No platform code branches on a specific provider.
 */
export interface MarketplaceAdapter {
  readonly code: MarketplaceCode;
  readonly capabilities: MarketplaceCapabilities;

  publishAd(tenantId: string, input: PublishAdInput): Promise<PublishAdResult>;
  archiveAd(tenantId: string, externalId: string): Promise<void>;
  fetchStats(tenantId: string, externalId: string, range: AdStatsRange): Promise<AdStatsPoint[]>;
  activatePromotion(tenantId: string, externalId: string, kind: PromotionKind): Promise<PromotionResult>;
  sendMessage(tenantId: string, message: OutboundMessage): Promise<void>;

  /** Turn a raw provider webhook body into normalized inbound events. */
  parseWebhook(body: unknown, headers: Record<string, string>): NormalizedInbound[];
}

export const MARKETPLACE_ADAPTER = Symbol('MARKETPLACE_ADAPTER');
