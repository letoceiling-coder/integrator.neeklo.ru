import type { MarketplaceCode } from '@neeklo/contracts';

/** Minor currency units (kopecks). */
export interface Money {
  amount: number;
  currency: string;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface Pagination {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

/** Execution context passed to every SDK call — never branch on `marketplaceCode` in core. */
export interface MarketplaceContext {
  organizationId: string;
  accountId: string;
  marketplaceCode: MarketplaceCode;
  correlationId: string;
  locale?: string;
}

export type CapabilityName =
  | 'identity'
  | 'account'
  | 'capabilities'
  | 'media'
  | 'messaging'
  | 'analytics'
  | 'orders'
  | 'notifications'
  | 'promotion'
  | 'publication'
  | 'statistics'
  | 'search'
  | 'catalog'
  | 'files'
  | 'moderation'
  | 'webhooks'
  | 'pricing'
  | 'regions'
  | 'categories'
  | 'attributes'
  | 'ai'
  | 'competitors'
  | 'budget'
  | 'automation'
  | 'reports'
  | 'health'
  | 'sync'
  | 'scheduler'
  | 'telemetry';

export interface CapabilityDescriptor {
  name: CapabilityName;
  version: string;
  supported: boolean;
  limits?: Record<string, number>;
}
