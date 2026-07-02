import { Injectable } from '@nestjs/common';
import type { MarketplaceCode, PromotionKind } from '@neeklo/contracts';
import type { MarketplaceProvider, MarketplaceContext, PublishListingInput } from '@neeklo/marketplace-sdk';
import type {
  AdStatsPoint,
  AdStatsRange,
  MarketplaceAdapter,
  MarketplaceCapabilities,
  NormalizedInbound,
  OutboundMessage,
  PromotionResult,
  PublishAdInput,
  PublishAdResult,
} from '../marketplace-adapter.port';
import { DomainError } from '@neeklo/kernel';

/**
 * Backward-compatibility bridge: wraps a {@link MarketplaceProvider} as the legacy
 * {@link MarketplaceAdapter} interface so existing code continues to work while new
 * code uses the SDK directly.
 */
@Injectable()
export class ProviderAdapterBridge implements MarketplaceAdapter {
  constructor(
    private readonly provider: MarketplaceProvider,
    public readonly code: MarketplaceCode,
  ) {}

  get capabilities(): MarketplaceCapabilities {
    const d = this.provider.getCapabilityDescriptors();
    return {
      messaging: d.some((c) => c.name === 'messaging' && c.supported),
      stats: d.some((c) => c.name === 'statistics' && c.supported),
      publishing: d.some((c) => c.name === 'publication' && c.supported),
      promotions: d.some((c) => c.name === 'promotion' && c.supported),
    };
  }

  private ctx(tenantId: string): MarketplaceContext {
    return {
      organizationId: tenantId,
      accountId: tenantId,
      marketplaceCode: this.code,
      correlationId: 'legacy-bridge',
    };
  }

  async publishAd(tenantId: string, input: PublishAdInput): Promise<PublishAdResult> {
    const pub = this.provider.resolve('publication');
    if (!pub) throw new DomainError('capability_unavailable', 'Publication not supported');
    const result = await pub.publish(this.ctx(tenantId), input as PublishListingInput);
    return { externalId: result.externalId, url: result.url };
  }

  async archiveAd(tenantId: string, externalId: string): Promise<void> {
    const pub = this.provider.resolve('publication');
    if (!pub) throw new DomainError('capability_unavailable', 'Publication not supported');
    await pub.archive(this.ctx(tenantId), externalId);
  }

  async fetchStats(tenantId: string, externalId: string, range: AdStatsRange): Promise<AdStatsPoint[]> {
    const stats = this.provider.resolve('statistics');
    if (!stats) throw new DomainError('capability_unavailable', 'Statistics not supported');
    const points = await stats.fetchAdStats(this.ctx(tenantId), externalId, range);
    return points.map((p) => ({ date: p.date, views: p.views, contacts: p.contacts, favorites: p.favorites }));
  }

  async activatePromotion(_tenantId: string, _externalId: string, _kind: PromotionKind): Promise<PromotionResult> {
    throw new DomainError('capability_unavailable', 'Promotions not supported by this provider');
  }

  async sendMessage(tenantId: string, message: OutboundMessage): Promise<void> {
    const messaging = this.provider.resolve('messaging');
    if (!messaging) throw new DomainError('capability_unavailable', 'Messaging not supported');
    await messaging.send(this.ctx(tenantId), message);
  }

  parseWebhook(body: unknown, headers: Record<string, string>): NormalizedInbound[] {
    const webhooks = this.provider.resolve('webhooks');
    if (!webhooks) return [];
    return webhooks.parse(body, headers).map((e) => ({
      kind: e.kind as NormalizedInbound['kind'],
      externalAdId: e.externalAdId,
      conversationId: e.conversationId,
      customerId: e.customerId,
      text: e.text,
      occurredAt: e.occurredAt,
      raw: e.raw,
    }));
  }
}

export function bridgeProvider(provider: MarketplaceProvider): ProviderAdapterBridge {
  return new ProviderAdapterBridge(provider, provider.manifest.marketplaceCode);
}
