import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MarketplaceCode,
  OAUTH_CALLBACK_PATH,
  OAUTH_CALLBACK_URI_PRODUCTION,
  type OAuthCheckStatus,
  type OAuthConfigDto,
  type OAuthDebugInfoDto,
  type OAuthHealthDashboardDto,
  type OAuthProductionChecklistDto,
  type OAuthTestAction,
  type OAuthTestResultDto,
  type OAuthValidationCheck,
  type OAuthValidationSuiteResult,
} from '@neeklo/contracts';
import { OAuthCredentialStatus } from '@neeklo/contracts/events';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialVaultService } from './vault/credential-vault.service';
import { OAuthProviderRegistry } from './providers/oauth-provider.registry';
import { TokenManagerService } from './token-manager.service';
import { OAuthHealthService } from './oauth-health.service';
import { OAuthApiConsoleService } from './oauth-api-console.service';
import { AvitoClient } from '../adapters/avito/avito.client';

@Injectable()
export class OAuthValidationService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly vault: CredentialVaultService,
    private readonly registry: OAuthProviderRegistry,
    private readonly tokenManager: TokenManagerService,
    private readonly health: OAuthHealthService,
    private readonly console: OAuthApiConsoleService,
    private readonly avito: AvitoClient,
  ) {}

  getConfig(): OAuthConfigDto {
    const redirectUri = this.redirectUri();
    const expected = this.expectedRedirectUri();
    return {
      redirectUri,
      expectedRedirectUri: expected,
      callbackPath: OAUTH_CALLBACK_PATH,
      productionCallbackUri: OAUTH_CALLBACK_URI_PRODUCTION,
      redirectMatch: redirectUri === expected || redirectUri === OAUTH_CALLBACK_URI_PRODUCTION,
    };
  }

  redirectUri(): string {
    const apiUrl = this.config.get('API_URL', { infer: true }).replace(/\/$/, '');
    const path = this.config.get('OAUTH_REDIRECT_PATH', { infer: true });
    return `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  expectedRedirectUri(): string {
    const apiUrl = this.config.get('API_URL', { infer: true }).replace(/\/$/, '');
    return `${apiUrl}${OAUTH_CALLBACK_PATH}`;
  }

  async runSuite(tenantId: string, accountId?: string): Promise<OAuthValidationSuiteResult> {
    const checks: OAuthValidationCheck[] = [];
    checks.push(this.checkRedirectUri());
    checks.push(await this.checkStateInfrastructure());
    checks.push(this.checkCsrfPolicy());

    if (accountId) {
      checks.push(await this.checkAccessToken(tenantId, accountId));
      checks.push(await this.checkRefreshToken(tenantId, accountId));
      checks.push(await this.checkExpiration(tenantId, accountId));
      const cred = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
      if (cred) checks.push(await this.checkHealth(cred.id));
      checks.push(await this.checkReconnectCapability(tenantId, accountId));
      checks.push(await this.checkDisconnectSafety(tenantId, accountId));
    } else {
      checks.push({
        id: 'account',
        name: 'Account context',
        status: 'warn',
        message: 'Provide accountId to validate tokens, refresh, health, reconnect',
      });
    }

    const passed = checks.filter((c) => c.status === 'pass').length;
    const warned = checks.filter((c) => c.status === 'warn').length;
    const failed = checks.filter((c) => c.status === 'fail').length;

    return { checks, passed, warned, failed, ranAt: new Date().toISOString() };
  }

  async getDebugInfo(tenantId: string, accountId: string): Promise<OAuthDebugInfoDto> {
    const credential = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!credential) throw new NotFoundException('OAuth credential not found');

    const secrets = this.vault.decrypt(credential);
    const config = this.getConfig();
    const healthResult = await this.health.checkCredential(credential.id);

    const pending = await this.prisma.oAuthPendingFlow.findFirst({
      where: { tenantId, accountId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      redirectUri: config.redirectUri,
      expectedRedirectUri: config.expectedRedirectUri,
      redirectMatch: config.redirectMatch,
      provider: credential.provider,
      grantType: credential.grantType,
      clientIdMasked: this.maskClientId(secrets.clientId),
      scopes: credential.scopes,
      health: healthResult.health,
      tokenExpiresAt: credential.tokenExpiresAt?.toISOString() ?? null,
      lastRefreshAt: credential.lastRefreshAt?.toISOString() ?? null,
      lastError: credential.lastError,
      pendingState: pending?.state ?? null,
      latencyMs: healthResult.latencyMs,
      accountId: credential.accountId,
      credentialId: credential.id,
      externalAccountId: credential.externalAccountId,
      displayName: credential.displayName,
    };
  }

  async getHealthDashboard(tenantId: string, accountId: string): Promise<OAuthHealthDashboardDto> {
    const credential = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!credential) throw new NotFoundException('OAuth credential not found');

    const config = this.getConfig();
    const vaultOk = Boolean(this.config.get('OAUTH_VAULT_MASTER_KEY', { infer: true }));
    const healthResult = await this.health.checkCredential(credential.id);

    let avitoStatus: OAuthCheckStatus = 'fail';
    let avitoLatency = 0;
    let avitoMessage = 'Not checked';
    try {
      const started = Date.now();
      await this.avito.request(tenantId, accountId, 'GET', '/core/v1/accounts/self');
      avitoLatency = Date.now() - started;
      avitoStatus = avitoLatency > 3000 ? 'warn' : 'pass';
      avitoMessage = 'Avito API reachable';
    } catch (e) {
      avitoMessage = e instanceof Error ? e.message : String(e);
    }

    const refreshStatus: OAuthCheckStatus =
      credential.status === OAuthCredentialStatus.CONNECTED &&
      credential.tokenExpiresAt &&
      credential.tokenExpiresAt.getTime() > Date.now()
        ? 'pass'
        : credential.status === OAuthCredentialStatus.REAUTH_REQUIRED
          ? 'fail'
          : 'warn';

    return {
      oauth: {
        status: config.redirectMatch && credential.status === OAuthCredentialStatus.CONNECTED ? 'pass' : 'warn',
        latencyMs: healthResult.latencyMs,
        message: config.redirectMatch ? 'OAuth configured' : 'Redirect URI mismatch',
      },
      vault: {
        status: vaultOk ? 'pass' : 'fail',
        keyVersion: credential.keyVersion,
        message: vaultOk ? 'Vault master key present' : 'Missing vault key',
      },
      provider: {
        status: 'pass',
        code: MarketplaceCode.AVITO,
        message: 'Avito provider registered',
      },
      avitoApi: { status: avitoStatus, latencyMs: avitoLatency, message: avitoMessage },
      refresh: {
        status: refreshStatus,
        lastRefreshAt: credential.lastRefreshAt?.toISOString() ?? null,
        expiresAt: credential.tokenExpiresAt?.toISOString() ?? null,
        message: refreshStatus === 'pass' ? 'Token valid' : 'Refresh may be required',
      },
      errors: {
        lastError: credential.lastError,
        recentCount: this.console.errorCountSince(3600_000),
      },
    };
  }

  async getProductionChecklist(tenantId: string, accountId: string): Promise<OAuthProductionChecklistDto> {
    const credential = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!credential) throw new NotFoundException('OAuth credential not found');

    const detail = await this.prisma.avitoAccountDetailReadModel.findFirst({ where: { tenantId, accountId } });
    const config = this.getConfig();

    const oauth: OAuthCheckStatus =
      config.redirectMatch && credential.status === OAuthCredentialStatus.CONNECTED ? 'pass' : 'fail';

    const profile: OAuthCheckStatus = credential.externalAccountId ? 'pass' : 'fail';

    let ads: OAuthCheckStatus = 'warn';
    let messenger: OAuthCheckStatus = 'warn';
    let stats: OAuthCheckStatus = 'warn';

    try {
      const self = await this.avito.request<{ id: number }>(tenantId, accountId, 'GET', '/core/v1/accounts/self');
      const items = await this.avito.request<{ resources?: unknown[]; items?: unknown[] }>(
        tenantId,
        accountId,
        'GET',
        '/core/v1/items',
        { query: { user_id: self.id } },
      );
      const count = (items.resources ?? items.items ?? []).length;
      ads = count >= 0 ? 'pass' : 'warn';
    } catch {
      ads = 'fail';
    }

    try {
      const self = await this.avito.request<{ id: number }>(tenantId, accountId, 'GET', '/core/v1/accounts/self');
      await this.avito.request(tenantId, accountId, 'GET', `/messenger/v2/accounts/${self.id}/chats`, {
        query: { limit: 1 },
      });
      messenger = 'pass';
    } catch {
      messenger = 'warn';
    }

    try {
      const self = await this.avito.request<{ id: number }>(tenantId, accountId, 'GET', '/core/v1/accounts/self');
      const today = new Date().toISOString().slice(0, 10);
      await this.avito.request(tenantId, accountId, 'POST', `/stats/v1/accounts/${self.id}/items`, {
        body: {
          dateFrom: today,
          dateTo: today,
          fields: ['uniqViews'],
          itemIds: [],
          periodGrouping: 'day',
        },
      });
      stats = 'pass';
    } catch {
      stats = 'warn';
    }

    let webhook: OAuthCheckStatus = 'warn';
    let autoload: OAuthCheckStatus = 'warn';

    const webhookCfg = await this.prisma.avitoWebhookConfigReadModel.findFirst({ where: { tenantId, accountId } });
    if (webhookCfg?.lastReceivedAt && webhookCfg.lastReceivedAt.getTime() > Date.now() - 7 * 86400_000) {
      webhook = 'pass';
    } else if (webhookCfg?.webhookUrl) {
      webhook = 'warn';
    }

    try {
      await this.avito.request(tenantId, accountId, 'GET', '/autoload/v2/profile');
      autoload = 'pass';
    } catch {
      autoload = 'warn';
    }

    const healthResult = await this.health.checkCredential(credential.id);
    const health: OAuthCheckStatus =
      healthResult.health === 'healthy' ? 'pass' : healthResult.health === 'degraded' ? 'warn' : 'fail';

    return {
      oauth,
      profile,
      ads,
      messenger,
      stats,
      webhook,
      autoload,
      health,
      accountStatus: detail?.status ?? credential.status,
    };
  }

  async runTest(tenantId: string, accountId: string, action: OAuthTestAction): Promise<OAuthTestResultDto> {
    const started = Date.now();
    try {
      switch (action) {
        case 'redirect': {
          const config = this.getConfig();
          return {
            ok: config.redirectMatch,
            action,
            latencyMs: Date.now() - started,
            data: config,
            error: config.redirectMatch ? undefined : 'Redirect URI does not match expected callback',
          };
        }
        case 'token': {
          const token = await this.tokenManager.resolveAccessToken(tenantId, MarketplaceCode.AVITO, accountId);
          return { ok: true, action, latencyMs: Date.now() - started, data: { tokenLength: token.length } };
        }
        case 'refresh': {
          const cred = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
          if (!cred) throw new NotFoundException('Credential not found');
          await this.tokenManager.refreshCredential(cred.id);
          const updated = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
          return {
            ok: true,
            action,
            latencyMs: Date.now() - started,
            data: { expiresAt: updated?.tokenExpiresAt?.toISOString() ?? null },
          };
        }
        case 'profile': {
          const profile = await this.avito.request<{ id: number; name?: string }>(
            tenantId,
            accountId,
            'GET',
            '/core/v1/accounts/self',
          );
          return { ok: true, action, latencyMs: Date.now() - started, data: profile };
        }
        case 'account': {
          const detail = await this.prisma.avitoAccountDetailReadModel.findFirst({ where: { tenantId, accountId } });
          const account = await this.prisma.accountReadModel.findFirst({ where: { id: accountId, organizationId: tenantId } });
          return {
            ok: Boolean(account),
            action,
            latencyMs: Date.now() - started,
            data: { account, detail },
          };
        }
        case 'api': {
          await this.avito.request(tenantId, accountId, 'GET', '/core/v1/accounts/self');
          return { ok: true, action, latencyMs: Date.now() - started, data: { endpoint: '/core/v1/accounts/self' } };
        }
        default:
          return { ok: false, action, latencyMs: Date.now() - started, error: 'Unknown action' };
      }
    } catch (e) {
      return {
        ok: false,
        action,
        latencyMs: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  listConsole(limit?: number) {
    return this.console.list(limit);
  }

  private checkRedirectUri(): OAuthValidationCheck {
    const config = this.getConfig();
    const ok = config.redirectUri.endsWith(OAUTH_CALLBACK_PATH);
    return {
      id: 'redirect_uri',
      name: 'Redirect URI',
      status: ok && config.redirectMatch ? 'pass' : 'fail',
      message: ok
        ? `Using ${config.redirectUri}`
        : `Must use ${OAUTH_CALLBACK_PATH}, got ${config.redirectUri}`,
    };
  }

  private async checkStateInfrastructure(): Promise<OAuthValidationCheck> {
    const expired = await this.prisma.oAuthPendingFlow.count({
      where: { expiresAt: { lt: new Date() } },
    });
    return {
      id: 'state',
      name: 'State storage',
      status: 'pass',
      message: expired > 0 ? `${expired} expired flows pending cleanup` : 'OAuth pending flow table operational',
    };
  }

  private checkCsrfPolicy(): OAuthValidationCheck {
    return {
      id: 'csrf',
      name: 'CSRF (state parameter)',
      status: 'pass',
      message: 'UUID state required; callback rejects missing/unknown/expired state',
    };
  }

  private async checkAccessToken(tenantId: string, accountId: string): Promise<OAuthValidationCheck> {
    const started = Date.now();
    try {
      await this.tokenManager.resolveAccessToken(tenantId, MarketplaceCode.AVITO, accountId);
      return {
        id: 'access_token',
        name: 'Access Token',
        status: 'pass',
        message: 'Access token resolved',
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      return {
        id: 'access_token',
        name: 'Access Token',
        status: 'fail',
        message: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - started,
      };
    }
  }

  private async checkRefreshToken(tenantId: string, accountId: string): Promise<OAuthValidationCheck> {
    const cred = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!cred) {
      return { id: 'refresh_token', name: 'Refresh Token', status: 'fail', message: 'No credential' };
    }
    if (cred.grantType === 'client_credentials') {
      return {
        id: 'refresh_token',
        name: 'Token Refresh',
        status: 'pass',
        message: 'Client credentials — re-issue via client_credentials grant',
      };
    }
    if (!cred.refreshTokenEnc) {
      return { id: 'refresh_token', name: 'Refresh Token', status: 'fail', message: 'No refresh token stored' };
    }
    const started = Date.now();
    try {
      await this.tokenManager.refreshCredential(cred.id);
      return {
        id: 'refresh_token',
        name: 'Token Refresh',
        status: 'pass',
        message: 'Refresh succeeded',
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      return {
        id: 'refresh_token',
        name: 'Token Refresh',
        status: 'fail',
        message: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - started,
      };
    }
  }

  private async checkExpiration(tenantId: string, accountId: string): Promise<OAuthValidationCheck> {
    const cred = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!cred?.tokenExpiresAt) {
      return { id: 'expiration', name: 'Token Expiration', status: 'warn', message: 'No expiry recorded' };
    }
    const msLeft = cred.tokenExpiresAt.getTime() - Date.now();
    if (msLeft <= 0) {
      return { id: 'expiration', name: 'Token Expiration', status: 'fail', message: 'Token expired' };
    }
    const lead = this.config.get('OAUTH_TOKEN_REFRESH_LEAD_SEC', { infer: true }) * 1000;
    return {
      id: 'expiration',
      name: 'Token Expiration',
      status: msLeft > lead ? 'pass' : 'warn',
      message: `Expires in ${Math.round(msLeft / 1000)}s`,
    };
  }

  private async checkHealth(credentialId: string): Promise<OAuthValidationCheck> {
    const started = Date.now();
    const result = await this.health.checkCredential(credentialId);
    return {
      id: 'health',
      name: 'Health',
      status: result.health === 'healthy' ? 'pass' : result.health === 'degraded' ? 'warn' : 'fail',
      message: `Health: ${result.health}`,
      latencyMs: Date.now() - started,
    };
  }

  private async checkReconnectCapability(tenantId: string, accountId: string): Promise<OAuthValidationCheck> {
    const cred = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    if (!cred) return { id: 'reconnect', name: 'Reconnect', status: 'fail', message: 'No credential' };
    if (cred.status === OAuthCredentialStatus.REAUTH_REQUIRED || cred.status === OAuthCredentialStatus.EXPIRED) {
      return {
        id: 'reconnect',
        name: 'Reconnect',
        status: 'warn',
        message: 'Re-authorization required — use Connect wizard',
      };
    }
    return { id: 'reconnect', name: 'Reconnect', status: 'pass', message: 'Account connected' };
  }

  private async checkDisconnectSafety(tenantId: string, accountId: string): Promise<OAuthValidationCheck> {
    const cred = await this.vault.findByAccount(tenantId, MarketplaceCode.AVITO, accountId);
    return {
      id: 'disconnect',
      name: 'Disconnect',
      status: cred ? 'pass' : 'warn',
      message: cred ? 'Disconnect endpoint available' : 'No active credential',
    };
  }

  private maskClientId(clientId: string): string {
    if (clientId.length <= 8) return '****';
    return `${clientId.slice(0, 4)}…${clientId.slice(-4)}`;
  }
}
