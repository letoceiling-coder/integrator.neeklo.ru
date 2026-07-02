import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceCode } from '@neeklo/contracts';
import {
  BaseMarketplaceProvider,
  type CapabilityDescriptor,
  type MarketplaceContext,
  type MarketplaceHealth,
  type MarketplaceIdentity,
  type MarketplaceMessaging,
  type MarketplaceStatistics,
  type MarketplaceWebhooks,
  type HealthStatus,
  type MarketplaceProviderManifest,
  type StatsPoint,
} from '@neeklo/marketplace-sdk';
import { DomainError } from '@neeklo/kernel';
import { PluginKind, type NeekloPlugin, type PluginContext, type PluginHealth } from '@neeklo/plugin-runtime';
import type { Env } from '../../config/env.schema';
import { AvitoClient } from '../../platform/adapters/avito/avito.client';

const CAPABILITIES: CapabilityDescriptor[] = [
  { name: 'identity', version: '1.0', supported: true },
  { name: 'account', version: '1.0', supported: true },
  { name: 'messaging', version: '1.0', supported: true },
  { name: 'statistics', version: '1.0', supported: true },
  { name: 'webhooks', version: '1.0', supported: true },
  { name: 'health', version: '1.0', supported: true },
  { name: 'publication', version: '1.0', supported: false },
  { name: 'promotion', version: '1.0', supported: false },
  { name: 'sync', version: '1.0', supported: false },
];

/** Avito SDK provider — implements marketplace capabilities without core knowing "avito". */
export class AvitoMarketplaceProvider extends BaseMarketplaceProvider {
  readonly manifest: MarketplaceProviderManifest = {
    id: '@neeklo/marketplace-avito',
    name: 'Avito Marketplace Provider',
    version: '1.0.0',
    marketplaceCode: MarketplaceCode.AVITO,
    description: 'Avito REST integration: messaging, statistics, webhooks, health',
    apiVersion: '1.0',
    minPlatformVersion: '0.2.0',
    capabilities: CAPABILITIES,
  };

  constructor(private readonly client: AvitoClient) {
    super();
    this.registerModule('identity', new AvitoIdentity(client));
    this.registerModule('account', new AvitoAccount(client));
    this.registerModule('messaging', new AvitoMessaging(client));
    this.registerModule('statistics', new AvitoStatistics(client));
    this.registerModule('webhooks', new AvitoWebhooks());
    this.registerModule('health', new AvitoHealth(client));
  }
}

class AvitoIdentity implements MarketplaceIdentity {
  constructor(private readonly client: AvitoClient) {}

  async authorize(_ctx: MarketplaceContext, credentials: { clientId: string; clientSecret: string }) {
    void credentials;
    const token = await this.client.getAccessToken();
    return { accessToken: token, tokenType: 'Bearer', expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  }

  async refresh() {
    throw new DomainError('not_supported', 'Avito uses client_credentials; refresh via authorize');
  }

  async revoke() {
    /* stateless client credentials */
  }

  async validate(_ctx: MarketplaceContext) {
    try {
      await this.client.getAccessToken();
      return { valid: true, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
    } catch {
      return { valid: false };
    }
  }
}

class AvitoAccount {
  constructor(private readonly client: AvitoClient) {}

  async getInfo(_ctx: MarketplaceContext) {
    const self = await this.client.request<{ id: number; name?: string }>('GET', '/core/v1/accounts/self');
    return {
      externalAccountId: String(self.id),
      displayName: self.name ?? `Avito #${self.id}`,
      verified: true,
    };
  }

  async getLimits() {
    return { dailyMessages: 10_000, dailyPublications: 0 };
  }
}

class AvitoMessaging implements MarketplaceMessaging {
  constructor(private readonly client: AvitoClient) {}

  private async selfId() {
    const self = await this.client.request<{ id: number }>('GET', '/core/v1/accounts/self');
    return self.id;
  }

  async send(_ctx: MarketplaceContext, message: { conversationId: string; text: string }) {
    const userId = await this.selfId();
    await this.client.request('POST', `/messenger/v1/accounts/${userId}/chats/${message.conversationId}/messages`, {
      body: { message: { text: message.text }, type: 'text' },
    });
  }

  async listConversations() {
    return { items: [], nextCursor: null };
  }
}

class AvitoStatistics implements MarketplaceStatistics {
  constructor(private readonly client: AvitoClient) {}

  async fetchAdStats(_ctx: MarketplaceContext, externalAdId: string, range: { from: string; to: string }): Promise<StatsPoint[]> {
    const self = await this.client.request<{ id: number }>('GET', '/core/v1/accounts/self');
    const res = await this.client.request<{
      result: { items: { itemId: number; stats: { date: string; uniqViews: number; uniqContacts: number; uniqFavorites: number }[] }[] };
    }>('POST', `/stats/v1/accounts/${self.id}/items`, {
      body: {
        dateFrom: range.from.slice(0, 10),
        dateTo: range.to.slice(0, 10),
        fields: ['uniqViews', 'uniqContacts', 'uniqFavorites'],
        itemIds: [Number(externalAdId)],
        periodGrouping: 'day',
      },
    });
    const item = res.result.items.find((i) => String(i.itemId) === externalAdId);
    return (item?.stats ?? []).map((s) => ({
      date: s.date,
      views: s.uniqViews ?? 0,
      contacts: s.uniqContacts ?? 0,
      favorites: s.uniqFavorites ?? 0,
    }));
  }

  async fetchAccountStats() {
    return { views: 0, contacts: 0 };
  }
}

class AvitoWebhooks implements MarketplaceWebhooks {
  parse(body: unknown) {
    const b = body as { payload?: { type?: string; value?: { chat_id?: string; author_id?: number; content?: { text?: string }; created?: number; item_id?: number } } };
    if (b?.payload?.type !== 'message' || !b.payload.value) return [];
    const v = b.payload.value;
    return [{
      kind: 'message' as const,
      conversationId: v.chat_id,
      customerId: v.author_id != null ? String(v.author_id) : undefined,
      externalAdId: v.item_id != null ? String(v.item_id) : undefined,
      text: v.content?.text,
      occurredAt: new Date((v.created ?? Date.now() / 1000) * 1000).toISOString(),
      raw: body,
    }];
  }

  verifySignature() {
    return true;
  }
}

class AvitoHealth implements MarketplaceHealth {
  constructor(private readonly client: AvitoClient) {}

  async check(_ctx: MarketplaceContext): Promise<HealthStatus> {
    const started = Date.now();
    try {
      await this.client.getAccessToken();
      return {
        status: 'healthy',
        latencyMs: Date.now() - started,
        checks: [{ name: 'auth', ok: true }],
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - started,
        checks: [{ name: 'auth', ok: false, message: e instanceof Error ? e.message : String(e) }],
        checkedAt: new Date().toISOString(),
      };
    }
  }
}

/** Plugin wrapper — Avito is installed/activated through the plugin runtime. */
@Injectable()
export class AvitoMarketplacePlugin implements NeekloPlugin {
  readonly manifest = {
    id: '@neeklo/marketplace-avito',
    name: 'Avito Marketplace',
    version: '1.0.0',
    kind: PluginKind.MARKETPLACE,
    description: 'Avito marketplace integration plugin',
    author: 'NEEKLO',
    minPlatformVersion: '0.2.0',
  };

  constructor(
    private readonly client: AvitoClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async validate(): Promise<void> {
    const id = this.config.get('AVITO_CLIENT_ID', { infer: true });
    const secret = this.config.get('AVITO_CLIENT_SECRET', { infer: true });
    if (!id || !secret) {
      // Degraded mode — UI and local drafts work; live Avito API calls require credentials.
      return;
    }
  }

  async onInstall(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Avito plugin installed');
  }

  async onActivate(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Avito plugin activated');
  }

  async onDeactivate(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Avito plugin deactivated');
  }

  async onUpdate(_ctx: PluginContext, fromVersion: string): Promise<void> {
    void fromVersion;
  }

  async onUninstall(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Avito plugin uninstalled');
  }

  async healthCheck(): Promise<PluginHealth> {
    try {
      await this.client.getAccessToken();
      return { status: 'healthy', checkedAt: new Date().toISOString() };
    } catch (e) {
      return {
        status: 'unhealthy',
        message: e instanceof Error ? e.message : String(e),
        checkedAt: new Date().toISOString(),
      };
    }
  }

  createProvider(): AvitoMarketplaceProvider {
    return new AvitoMarketplaceProvider(this.client);
  }
}
