import { Injectable } from '@nestjs/common';
import type { MarketplaceCode } from '@neeklo/contracts';
import { NotFoundError } from '@neeklo/kernel';
import { MarketplaceRegistryService } from '../marketplace-core/registry/marketplace-registry.service';
import { bridgeProvider, type ProviderAdapterBridge } from './provider-adapter.bridge';
import type { MarketplaceAdapter } from './marketplace-adapter.port';

/**
 * Legacy adapter registry — delegates to {@link MarketplaceRegistryService} via bridge.
 * Existing code using AdapterRegistry continues to work without provider-specific branches.
 */
@Injectable()
export class AdapterRegistry {
  constructor(private readonly marketplaceRegistry: MarketplaceRegistryService) {}

  get(code: MarketplaceCode): MarketplaceAdapter {
    if (!this.marketplaceRegistry.hasProvider(code)) {
      throw new NotFoundError('MarketplaceAdapter', code);
    }
    return bridgeProvider(this.marketplaceRegistry.getProvider(code));
  }

  has(code: MarketplaceCode): boolean {
    return this.marketplaceRegistry.hasProvider(code);
  }

  list(): MarketplaceAdapter[] {
    return this.marketplaceRegistry.listProviders().map((p) => bridgeProvider(p));
  }
}
