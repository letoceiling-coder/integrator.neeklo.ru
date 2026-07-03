import { Injectable } from '@nestjs/common';
import { MarketplaceCode } from '@neeklo/contracts';
import type { OAuthProviderAdapter } from './oauth-provider.types';
import { AvitoOAuthProvider } from './avito-oauth.provider';

/** Resolves marketplace-specific OAuth adapters (Avito first; Ozon/WB/YM extensible). */
@Injectable()
export class OAuthProviderRegistry {
  private readonly adapters = new Map<MarketplaceCode, OAuthProviderAdapter>();

  constructor(avito: AvitoOAuthProvider) {
    this.adapters.set(MarketplaceCode.AVITO, avito);
  }

  get(provider: MarketplaceCode): OAuthProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`OAuth provider not registered: ${provider}`);
    }
    return adapter;
  }

  list(): MarketplaceCode[] {
    return [...this.adapters.keys()];
  }
}
