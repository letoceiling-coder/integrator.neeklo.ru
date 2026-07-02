import type { MarketplaceCode } from '@neeklo/contracts';
import type { CapabilityDescriptor } from '../types/common';

export interface MarketplaceProviderManifest {
  /** Stable plugin id, e.g. `@neeklo/marketplace-avito`. */
  id: string;
  name: string;
  version: string;
  marketplaceCode: MarketplaceCode;
  description: string;
  /** Semantic API version the provider implements. */
  apiVersion: string;
  /** Minimum NEEKLO platform version required. */
  minPlatformVersion: string;
  capabilities: CapabilityDescriptor[];
  /** Opaque provider metadata (docs URL, support email, …). */
  metadata?: Record<string, unknown>;
}
