import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceCode } from '@neeklo/contracts';
import type { Env } from '../../../config/env.schema';
import type { OAuthProviderAdapter, TokenExchangeResult } from './oauth-provider.types';

@Injectable()
export class AvitoOAuthProvider implements OAuthProviderAdapter {
  readonly config = {
    code: MarketplaceCode.AVITO,
    authorizationUrl: 'https://avito.ru/oauth',
    tokenUrl: 'https://api.avito.ru/token',
    defaultScopes: [] as string[],
    supportsRefresh: true,
    supportsPkce: false,
  };

  constructor(private readonly envConfig: ConfigService<Env, true>) {
    const scopes = this.envConfig.get('AVITO_OAUTH_SCOPES', { infer: true });
    this.config.defaultScopes = scopes.split(',').map((s) => s.trim()).filter(Boolean);
  }

  private get baseUrl(): string {
    return this.envConfig.get('AVITO_BASE_URL', { infer: true });
  }

  buildAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: string[];
    codeChallenge?: string;
  }): string {
    const url = new URL(this.config.authorizationUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('pro_users_flow', 'true');
    url.searchParams.set('client_id', params.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('scope', params.scopes.join(','));
    url.searchParams.set('state', params.state);
    if (params.codeChallenge) {
      url.searchParams.set('code_challenge', params.codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    return url.toString();
  }

  async exchangeAuthorizationCode(params: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<TokenExchangeResult> {
    return this.tokenRequest({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
    });
  }

  async exchangeClientCredentials(params: {
    clientId: string;
    clientSecret: string;
  }): Promise<TokenExchangeResult> {
    return this.tokenRequest({
      grant_type: 'client_credentials',
      client_id: params.clientId,
      client_secret: params.clientSecret,
    });
  }

  async refreshAccessToken(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<TokenExchangeResult> {
    return this.tokenRequest({
      grant_type: 'refresh_token',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
    });
  }

  async fetchAccountProfile(
    accessToken: string,
    baseUrl?: string,
  ): Promise<{ externalAccountId: string; displayName: string }> {
    const root = (baseUrl ?? this.baseUrl).replace(/\/$/, '');
    const res = await fetch(`${root}/core/v1/accounts/self`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Avito profile fetch failed: ${res.status}`);
    }
    const json = (await res.json()) as { id: number; name?: string };
    return {
      externalAccountId: String(json.id),
      displayName: json.name ?? `Avito #${json.id}`,
    };
  }

  private async tokenRequest(body: Record<string, string>): Promise<TokenExchangeResult> {
    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Avito token exchange failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
      token_type: string;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresIn: json.expires_in,
      scope: json.scope ?? null,
      tokenType: json.token_type,
    };
  }
}
