import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceCode } from '@neeklo/contracts';
import { OAuthStatus } from './oauth.constants';
import type { AppendContext } from '@neeklo/kernel';
import type { Env } from '../../config/env.schema';
import { CredentialVaultService } from './vault/credential-vault.service';
import { OAuthProviderRegistry } from './providers/oauth-provider.registry';
import { OAuthEventPublisher } from './events/oauth-event.publisher';

/** Proactively refreshes access tokens before expiry. */
@Injectable()
export class TokenManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenManagerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly vault: CredentialVaultService,
    private readonly registry: OAuthProviderRegistry,
    private readonly events: OAuthEventPublisher,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.refreshExpiring().catch((e) =>
        this.logger.error(`Token refresh sweep failed: ${e instanceof Error ? e.message : e}`),
      );
    }, 60_000);
    void this.refreshExpiring();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async refreshExpiring(): Promise<number> {
    const leadSec = this.config.get('OAUTH_TOKEN_REFRESH_LEAD_SEC', { infer: true });
    const threshold = new Date(Date.now() + leadSec * 1000);
    const expiring = await this.vault.listExpiringBefore(threshold);
    let refreshed = 0;

    for (const credential of expiring) {
      if (!credential.refreshTokenEnc && credential.grantType === 'client_credentials') {
        try {
          await this.refreshCredential(credential.id);
          refreshed++;
        } catch {
          /* logged inside */
        }
        continue;
      }
      if (credential.refreshTokenEnc) {
        try {
          await this.refreshCredential(credential.id);
          refreshed++;
        } catch {
          /* logged inside */
        }
      }
    }
    return refreshed;
  }

  async refreshCredential(credentialId: string, ctx?: AppendContext): Promise<void> {
    const record = await this.vault.findById(credentialId);
    if (!record) return;

    const appendCtx = ctx ?? this.events.systemContext(record.tenantId);
    const adapter = this.registry.get(record.provider);
    const secrets = this.vault.decrypt(record);

    try {
      let tokens;
      if (record.grantType === 'client_credentials' || !secrets.refreshToken) {
        tokens = await adapter.exchangeClientCredentials({
          clientId: secrets.clientId,
          clientSecret: secrets.clientSecret,
        });
      } else {
        tokens = await adapter.refreshAccessToken({
          clientId: secrets.clientId,
          clientSecret: secrets.clientSecret,
          refreshToken: secrets.refreshToken,
        });
      }

      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
      await this.vault.updateTokens(credentialId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? secrets.refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: tokens.scope?.split(',').filter(Boolean) ?? record.scopes,
      });

      await this.events.tokenRefreshed(
        record.tenantId,
        credentialId,
        record.provider,
        record.accountId,
        expiresAt,
        appendCtx,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.vault.updateStatus(credentialId, {
        status: OAuthStatus.REAUTH_REQUIRED,
        health: 'unhealthy',
        lastError: message,
      });
      await this.events.tokenRefreshFailed(
        record.tenantId,
        credentialId,
        record.provider,
        record.accountId,
        message,
        appendCtx,
      );

      if (record.tokenExpiresAt && record.tokenExpiresAt.getTime() <= Date.now()) {
        await this.vault.updateStatus(credentialId, { status: OAuthStatus.EXPIRED });
        await this.events.tokenExpired(
          record.tenantId,
          credentialId,
          record.provider as MarketplaceCode,
          record.accountId,
          appendCtx,
        );
      }
      throw e;
    }
  }

  /** Resolves a valid access token, refreshing if within lead window. */
  async resolveAccessToken(tenantId: string, provider: MarketplaceCode, accountId: string): Promise<string> {
    const record = await this.vault.findByAccount(tenantId, provider, accountId);
    if (!record) {
      throw new Error(`No OAuth credential for account ${accountId}`);
    }
    if (record.status !== OAuthStatus.CONNECTED && record.status !== OAuthStatus.PENDING) {
      throw new Error(`OAuth credential status: ${record.status}`);
    }

    const leadSec = this.config.get('OAUTH_TOKEN_REFRESH_LEAD_SEC', { infer: true });
    const needsRefresh =
      !record.tokenExpiresAt ||
      record.tokenExpiresAt.getTime() <= Date.now() + leadSec * 1000;

    if (needsRefresh) {
      await this.refreshCredential(record.id);
      const refreshed = await this.vault.findByAccount(tenantId, provider, accountId);
      if (!refreshed?.accessTokenEnc) throw new Error('Token refresh produced no access token');
      return this.vault.decrypt(refreshed).accessToken!;
    }

    const token = await this.vault.getAccessToken(tenantId, provider, accountId);
    if (!token) throw new Error('Access token unavailable');
    return token;
  }
}
