import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { OAuthEventType } from '@neeklo/contracts/events';
import type { EventType, MarketplaceCode } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import { EventStoreService } from '../../event-store/event-store.service';
import { EventBusService } from '../../event-bus/event-bus.service';

@Injectable()
export class OAuthEventPublisher {
  constructor(
    private readonly eventStore: EventStoreService,
    private readonly eventBus: EventBusService,
  ) {}

  private async publish(
    tenantId: string,
    credentialId: string,
    type: EventType,
    payload: Record<string, unknown>,
    ctx: AppendContext,
  ): Promise<void> {
    const events = await this.eventStore.readStream('oauth', credentialId);
    const expectedVersion = events.length > 0 ? events[events.length - 1]!.streamVersion : -1;
    const stored = await this.eventStore.append('oauth', credentialId, [{ type, payload }], {
      ...ctx,
      tenantId,
      expectedVersion,
    });
    await this.eventBus.publish(stored);
  }

  connected(
    tenantId: string,
    credentialId: string,
    data: {
      provider: MarketplaceCode;
      accountId: string;
      externalAccountId: string | null;
      scopes: string[];
      grantType: 'authorization_code' | 'client_credentials';
      tokenExpiresAt: Date | null;
    },
    ctx: AppendContext,
  ) {
    return this.publish(tenantId, credentialId, OAuthEventType.OAuthConnected, {
      provider: data.provider,
      accountId: data.accountId,
      credentialId,
      externalAccountId: data.externalAccountId,
      scopes: data.scopes,
      grantType: data.grantType,
      connectedAt: new Date().toISOString(),
      tokenExpiresAt: data.tokenExpiresAt?.toISOString() ?? null,
    }, ctx);
  }

  disconnected(
    tenantId: string,
    credentialId: string,
    provider: MarketplaceCode,
    accountId: string,
    reason: string | null,
    ctx: AppendContext,
  ) {
    return this.publish(tenantId, credentialId, OAuthEventType.OAuthDisconnected, {
      provider,
      accountId,
      credentialId,
      reason,
      disconnectedAt: new Date().toISOString(),
    }, ctx);
  }

  tokenRefreshed(
    tenantId: string,
    credentialId: string,
    provider: MarketplaceCode,
    accountId: string,
    tokenExpiresAt: Date,
    ctx: AppendContext,
  ) {
    return this.publish(tenantId, credentialId, OAuthEventType.TokenRefreshed, {
      provider,
      accountId,
      credentialId,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
      refreshedAt: new Date().toISOString(),
    }, ctx);
  }

  tokenExpired(tenantId: string, credentialId: string, provider: MarketplaceCode, accountId: string, ctx: AppendContext) {
    return this.publish(tenantId, credentialId, OAuthEventType.TokenExpired, {
      provider,
      accountId,
      credentialId,
      expiredAt: new Date().toISOString(),
    }, ctx);
  }

  tokenRefreshFailed(
    tenantId: string,
    credentialId: string,
    provider: MarketplaceCode,
    accountId: string,
    error: string,
    ctx: AppendContext,
  ) {
    return this.publish(tenantId, credentialId, OAuthEventType.TokenRefreshFailed, {
      provider,
      accountId,
      credentialId,
      error,
      failedAt: new Date().toISOString(),
    }, ctx);
  }

  credentialUpdated(
    tenantId: string,
    credentialId: string,
    provider: MarketplaceCode,
    accountId: string,
    fields: string[],
    ctx: AppendContext,
  ) {
    return this.publish(tenantId, credentialId, OAuthEventType.CredentialUpdated, {
      provider,
      accountId,
      credentialId,
      fields,
      updatedAt: new Date().toISOString(),
    }, ctx);
  }

  credentialRemoved(
    tenantId: string,
    credentialId: string,
    provider: MarketplaceCode,
    accountId: string,
    ctx: AppendContext,
  ) {
    return this.publish(tenantId, credentialId, OAuthEventType.CredentialRemoved, {
      provider,
      accountId,
      credentialId,
      removedAt: new Date().toISOString(),
    }, ctx);
  }

  systemContext(tenantId: string, correlationId = uuid()): AppendContext {
    return {
      tenantId,
      actor: { type: 'system', id: 'oauth-center' },
      correlationId,
    };
  }
}
