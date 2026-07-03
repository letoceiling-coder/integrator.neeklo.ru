import { Injectable } from '@nestjs/common';
import { MarketplaceCode, OAuthCredentialStatus, type PromotionKind } from '@neeklo/contracts';
import { DomainError } from '@neeklo/kernel';
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
import { CredentialVaultService } from '../../oauth-center/vault/credential-vault.service';
import { AvitoClient } from './avito.client';

/**
 * Avito integration.
 *
 * Messaging and item statistics map to Avito's public REST endpoints. Publishing and paid
 * promotions on Avito are delivered through the Autoload feed pipeline (a separate, larger
 * module) — until that ships, {@link capabilities} advertises them as unavailable and the
 * corresponding methods fail fast rather than pretend. Nothing here is a placeholder mock:
 * capability flags are the contract callers must respect.
 */
@Injectable()
export class AvitoAdapter implements MarketplaceAdapter {
  readonly code = MarketplaceCode.AVITO;
  readonly capabilities: MarketplaceCapabilities = {
    messaging: true,
    stats: true,
    publishing: false,
    promotions: false,
  };

  constructor(
    private readonly client: AvitoClient,
    private readonly vault: CredentialVaultService,
  ) {}

  private async resolveAccountId(tenantId: string): Promise<string> {
    const credentials = await this.vault.listByTenant(tenantId, MarketplaceCode.AVITO);
    const connected = credentials.find((c) => c.status === OAuthCredentialStatus.CONNECTED);
    if (!connected) {
      throw new DomainError('avito_not_configured', 'No connected Avito OAuth account for tenant');
    }
    return connected.accountId;
  }

  private async selfId(tenantId: string): Promise<number> {
    const accountId = await this.resolveAccountId(tenantId);
    const self = await this.client.request<{ id: number }>(
      tenantId,
      accountId,
      'GET',
      '/core/v1/accounts/self',
    );
    return self.id;
  }

  async publishAd(_tenantId: string, _input: PublishAdInput): Promise<PublishAdResult> {
    throw new DomainError(
      'capability_unavailable',
      'Avito publishing is delivered via the Autoload feed pipeline (not the REST item API).',
      { capability: 'publishing' },
    );
  }

  async archiveAd(_tenantId: string, _externalId: string): Promise<void> {
    throw new DomainError(
      'capability_unavailable',
      'Avito ad archival is managed through Autoload feed state.',
      { capability: 'publishing' },
    );
  }

  async fetchStats(
    tenantId: string,
    externalId: string,
    range: AdStatsRange,
  ): Promise<AdStatsPoint[]> {
    const accountId = await this.resolveAccountId(tenantId);
    const userId = await this.selfId(tenantId);
    const res = await this.client.request<{
      result: { items: { itemId: number; stats: { date: string; uniqViews: number; uniqContacts: number; uniqFavorites: number }[] }[] };
    }>(tenantId, accountId, 'POST', `/stats/v1/accounts/${userId}/items`, {
      body: {
        dateFrom: range.from.slice(0, 10),
        dateTo: range.to.slice(0, 10),
        fields: ['uniqViews', 'uniqContacts', 'uniqFavorites'],
        itemIds: [Number(externalId)],
        periodGrouping: 'day',
      },
    });

    const item = res.result.items.find((i) => String(i.itemId) === externalId);
    return (item?.stats ?? []).map((s) => ({
      date: s.date,
      views: s.uniqViews ?? 0,
      contacts: s.uniqContacts ?? 0,
      favorites: s.uniqFavorites ?? 0,
    }));
  }

  async activatePromotion(
    _tenantId: string,
    _externalId: string,
    _kind: PromotionKind,
  ): Promise<PromotionResult> {
    throw new DomainError(
      'capability_unavailable',
      'Avito promotions are purchased via Autoload feed flags.',
      { capability: 'promotions' },
    );
  }

  async sendMessage(tenantId: string, message: OutboundMessage): Promise<void> {
    const accountId = await this.resolveAccountId(tenantId);
    const userId = await this.selfId(tenantId);
    await this.client.request(
      tenantId,
      accountId,
      'POST',
      `/messenger/v1/accounts/${userId}/chats/${message.conversationId}/messages`,
      { body: { message: { text: message.text }, type: 'text' } },
    );
  }

  parseWebhook(body: unknown, _headers: Record<string, string>): NormalizedInbound[] {
    // Avito messenger webhook: { payload: { type: 'message', value: {...} } }
    const b = body as {
      payload?: {
        type?: string;
        value?: {
          chat_id?: string;
          author_id?: number;
          content?: { text?: string };
          created?: number;
          item_id?: number;
        };
      };
    };
    if (b?.payload?.type !== 'message' || !b.payload.value) return [];
    const v = b.payload.value;
    return [
      {
        kind: 'message',
        conversationId: v.chat_id,
        customerId: v.author_id != null ? String(v.author_id) : undefined,
        externalAdId: v.item_id != null ? String(v.item_id) : undefined,
        text: v.content?.text,
        occurredAt: new Date((v.created ?? Date.now() / 1000) * 1000).toISOString(),
        raw: body,
      },
    ];
  }
}
