import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import type { AppendContext } from '@neeklo/kernel';
import {
  MarketplaceCode,
  OAuthCredentialStatus,
  OAUTH_CALLBACK_PATH,
  type AvitoConnectDto,
  type CurrentUser,
  type OAuthAccountStatusDto,
  type OAuthCallbackResult,
  type OAuthConnectResponse,
} from '@neeklo/contracts';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { ObservabilityService } from '../marketplace-core/observability/observability.service';
import { AccountRepository } from '../../modules/account/domain/account.repository';
import { AccountAggregate } from '../../modules/account/domain/account.aggregate';
import { CredentialVaultService } from './vault/credential-vault.service';
import { CredentialCipherService } from './encryption/credential-cipher.service';
import { OAuthProviderRegistry } from './providers/oauth-provider.registry';
import { OAuthEventPublisher } from './events/oauth-event.publisher';
import { TokenManagerService } from './token-manager.service';
import { OAuthHealthService } from './oauth-health.service';
import { OAuthProvisioningService } from './oauth-provisioning.service';
import type { OAuthCredentialRecord } from './providers/oauth-provider.types';

@Injectable()
export class OAuthCenterService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly vault: CredentialVaultService,
    private readonly cipher: CredentialCipherService,
    private readonly registry: OAuthProviderRegistry,
    private readonly events: OAuthEventPublisher,
    private readonly tokenManager: TokenManagerService,
    private readonly health: OAuthHealthService,
    private readonly observability: ObservabilityService,
    private readonly accountRepo: AccountRepository,
    private readonly provisioning: OAuthProvisioningService,
  ) {}

  private redirectUri(): string {
    const apiUrl = this.config.get('API_URL', { infer: true }).replace(/\/$/, '');
    const path = this.config.get('OAUTH_REDIRECT_PATH', { infer: true });
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (normalized !== OAUTH_CALLBACK_PATH) {
      return `${apiUrl}${OAUTH_CALLBACK_PATH}`;
    }
    return `${apiUrl}${normalized}`;
  }

  private webOAuthUrl(query?: Record<string, string>): string {
    const base = `${this.config.get('WEB_URL', { infer: true }).replace(/\/$/, '')}/settings/oauth`;
    if (!query || !Object.keys(query).length) return base;
    const params = new URLSearchParams(query);
    return `${base}?${params}`;
  }

  async connectAvito(
    tenantId: string,
    user: CurrentUser,
    dto: AvitoConnectDto,
    ctx: AppendContext,
  ): Promise<OAuthConnectResponse> {
    const provider = MarketplaceCode.AVITO;
    const adapter = this.registry.get(provider);
    const accountId = uuid();
    const displayName = dto.displayName ?? 'Avito Account';
    const scopes = dto.scopes?.length ? dto.scopes : adapter.config.defaultScopes;

    const account = AccountAggregate.create(accountId, tenantId, provider, displayName);
    await this.accountRepo.save(account, { ...ctx, tenantId });

    const credential = await this.vault.store({
      tenantId,
      provider,
      accountId,
      displayName,
      grantType: dto.grantType,
      clientId: dto.clientId,
      clientSecret: dto.clientSecret,
      scopes,
      status: OAuthCredentialStatus.PENDING,
    });

    await this.audit(tenantId, user.id, 'oauth.connect.start', credential.id, {
      provider,
      accountId,
      grantType: dto.grantType,
    });

    if (dto.grantType === 'client_credentials') {
      const tokens = await adapter.exchangeClientCredentials({
        clientId: dto.clientId,
        clientSecret: dto.clientSecret,
      });
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
      const profile = await adapter.fetchAccountProfile(tokens.accessToken, this.config.get('AVITO_BASE_URL', { infer: true }));

      const updated = await this.vault.updateTokens(credential.id, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        externalAccountId: profile.externalAccountId,
        scopes: tokens.scope?.split(',').filter(Boolean) ?? scopes,
      });

      account.authorize(profile.externalAccountId, expiresAt.toISOString());
      await this.accountRepo.save(account, { ...ctx, tenantId });

      await this.events.connected(tenantId, updated.id, {
        provider,
        accountId,
        externalAccountId: profile.externalAccountId,
        scopes: updated.scopes,
        grantType: 'client_credentials',
        tokenExpiresAt: expiresAt,
      }, ctx);

      await this.audit(tenantId, user.id, 'oauth.connect.completed', updated.id, {
        provider,
        accountId,
        grantType: 'client_credentials',
      });

      void this.provisioning.provisionAfterConnect(tenantId, accountId, ctx).catch(() => undefined);

      return {
        accountId,
        credentialId: updated.id,
        grantType: 'client_credentials',
        status: OAuthCredentialStatus.CONNECTED,
      };
    }

    const state = uuid();
    const redirectUri = this.redirectUri();
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const keyVersion = this.cipher.currentKeyVersion();

    await this.prisma.oAuthPendingFlow.create({
      data: {
        tenantId,
        provider,
        state,
        accountId,
        clientIdEnc: this.cipher.encrypt(dto.clientId, keyVersion),
        clientSecretEnc: this.cipher.encrypt(dto.clientSecret, keyVersion),
        scopes,
        redirectUri,
        userId: user.id,
        expiresAt,
      },
    });

    const authorizationUrl = adapter.buildAuthorizationUrl({
      clientId: dto.clientId,
      redirectUri,
      state,
      scopes,
    });

    return {
      accountId,
      credentialId: credential.id,
      authorizationUrl,
      state,
      grantType: 'authorization_code',
      status: OAuthCredentialStatus.PENDING,
    };
  }

  async handleAvitoCallback(
    query: { state?: string; code?: string; error?: string; error_description?: string },
  ): Promise<OAuthCallbackResult> {
    if (query.error) {
      return {
        success: false,
        error: query.error_description ?? query.error,
        redirectUrl: this.webOAuthUrl({ error: query.error }),
      };
    }

    if (!query.state || !query.code) {
      return {
        success: false,
        error: 'Missing state or authorization code',
        redirectUrl: this.webOAuthUrl({ error: 'invalid_callback' }),
      };
    }

    const flow = await this.prisma.oAuthPendingFlow.findUnique({ where: { state: query.state } });
    if (!flow || flow.expiresAt.getTime() < Date.now()) {
      return {
        success: false,
        error: 'OAuth session expired or invalid',
        redirectUrl: this.webOAuthUrl({ error: 'expired' }),
      };
    }

    const provider = MarketplaceCode.AVITO;
    const adapter = this.registry.get(provider);
    const clientId = this.cipher.decrypt(flow.clientIdEnc);
    const clientSecret = this.cipher.decrypt(flow.clientSecretEnc);
    const ctx = this.events.systemContext(flow.tenantId);

    try {
      const tokens = await adapter.exchangeAuthorizationCode({
        clientId,
        clientSecret,
        code: query.code,
        redirectUri: flow.redirectUri,
      });
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
      const profile = await adapter.fetchAccountProfile(
        tokens.accessToken,
        this.config.get('AVITO_BASE_URL', { infer: true }),
      );

      const credential = await this.vault.findByAccount(flow.tenantId, provider, flow.accountId);
      if (!credential) throw new NotFoundException('Credential not found');

      const updated = await this.vault.updateTokens(credential.id, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        externalAccountId: profile.externalAccountId,
        scopes: tokens.scope?.split(',').filter(Boolean) ?? flow.scopes,
      });

      const account = await this.accountRepo.load(flow.accountId);
      if (account) {
        account.authorize(profile.externalAccountId, expiresAt.toISOString());
        await this.accountRepo.save(account, { ...ctx, tenantId: flow.tenantId });
      }

      await this.events.connected(flow.tenantId, updated.id, {
        provider,
        accountId: flow.accountId,
        externalAccountId: profile.externalAccountId,
        scopes: updated.scopes,
        grantType: 'authorization_code',
        tokenExpiresAt: expiresAt,
      }, ctx);

      await this.audit(flow.tenantId, flow.userId, 'oauth.callback.success', updated.id, {
        provider,
        accountId: flow.accountId,
      });

      await this.prisma.oAuthPendingFlow.delete({ where: { id: flow.id } });

      void this.provisioning.provisionAfterConnect(flow.tenantId, flow.accountId, ctx).catch(() => undefined);

      return {
        success: true,
        accountId: flow.accountId,
        redirectUrl: this.webOAuthUrl({ connected: '1', accountId: flow.accountId }),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.audit(flow.tenantId, flow.userId, 'oauth.callback.failed', flow.accountId, {
        error: message,
      });
      return {
        success: false,
        error: message,
        redirectUrl: this.webOAuthUrl({ error: 'token_exchange_failed' }),
      };
    }
  }

  async disconnectAvito(
    tenantId: string,
    userId: string,
    accountId: string,
    reason: string | undefined,
    ctx: AppendContext,
  ): Promise<void> {
    const credential = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!credential) throw new NotFoundException('OAuth credential not found');

    await this.vault.updateStatus(credential.id, {
      status: OAuthCredentialStatus.DISCONNECTED,
      health: 'unknown',
    });
    await this.vault.remove(credential.id);

    const account = await this.accountRepo.load(accountId);
    if (account) {
      account.failAuthorization(reason ?? 'disconnected');
      await this.accountRepo.save(account, { ...ctx, tenantId });
    }

    await this.events.disconnected(
      tenantId,
      credential.id,
      MarketplaceCode.AVITO,
      accountId,
      reason ?? null,
      ctx,
    );
    await this.events.credentialRemoved(tenantId, credential.id, MarketplaceCode.AVITO, accountId, ctx);
    await this.audit(tenantId, userId, 'oauth.disconnect', credential.id, { accountId, reason });
  }

  async refreshAvito(tenantId: string, userId: string, accountId: string, ctx: AppendContext): Promise<OAuthAccountStatusDto> {
    const credential = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!credential) throw new NotFoundException('OAuth credential not found');

    await this.tokenManager.refreshCredential(credential.id, ctx);
    await this.audit(tenantId, userId, 'oauth.refresh.manual', credential.id, { accountId });

    const status = await this.getAccountStatus(tenantId, accountId);
    if (!status) throw new NotFoundException('Account status not found');
    return status;
  }

  async getAccountStatus(tenantId: string, accountId: string): Promise<OAuthAccountStatusDto | null> {
    const credential = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!credential) return null;

    const detail = await this.prisma.avitoAccountDetailReadModel.findFirst({
      where: { tenantId, accountId },
    });

    return this.toStatusDto(credential, detail?.lastSyncAt ?? null);
  }

  async listAvitoAccounts(tenantId: string): Promise<OAuthAccountStatusDto[]> {
    const credentials = await this.vault.listByTenant(tenantId, MarketplaceCode.AVITO);
    const details = await this.prisma.avitoAccountDetailReadModel.findMany({ where: { tenantId } });
    const syncMap = new Map(details.map((d: { accountId: string; lastSyncAt: Date | null }) => [d.accountId, d.lastSyncAt]));

    return credentials.map((c) => this.toStatusDto(c, syncMap.get(c.accountId) ?? null));
  }

  async checkHealth(tenantId: string, accountId: string): Promise<OAuthAccountStatusDto> {
    const credential = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!credential) throw new NotFoundException('OAuth credential not found');

    await this.health.checkCredential(credential.id);
    const status = await this.getAccountStatus(tenantId, accountId);
    if (!status) throw new NotFoundException('Account status not found');
    return status;
  }

  private toStatusDto(credential: OAuthCredentialRecord, lastSyncAt: Date | null): OAuthAccountStatusDto {
    return {
      accountId: credential.accountId,
      credentialId: credential.id,
      provider: credential.provider,
      displayName: credential.displayName,
      externalAccountId: credential.externalAccountId,
      status: credential.status,
      health: credential.health,
      scopes: credential.scopes,
      connected: credential.status === OAuthCredentialStatus.CONNECTED,
      tokenExpiresAt: credential.tokenExpiresAt?.toISOString() ?? null,
      refreshExpiresAt: credential.refreshExpiresAt?.toISOString() ?? null,
      lastRefreshAt: credential.lastRefreshAt?.toISOString() ?? null,
      lastSuccessAt: credential.lastSuccessAt?.toISOString() ?? null,
      lastError: credential.lastError,
      lastSyncAt: lastSyncAt?.toISOString() ?? null,
      grantType: credential.grantType,
    };
  }

  private async audit(
    tenantId: string,
    userId: string,
    action: string,
    resourceId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.observability.audit({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action,
      resourceType: 'oauth_credential',
      resourceId,
      correlationId: uuid(),
      details,
    });
  }
}
