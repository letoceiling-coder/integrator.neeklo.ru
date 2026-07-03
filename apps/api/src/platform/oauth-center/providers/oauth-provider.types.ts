import type { MarketplaceCode } from '@neeklo/contracts';
import type { OAuthCredentialStatus } from '@neeklo/contracts';

export interface DecryptedOAuthCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface OAuthCredentialRecord {
  id: string;
  tenantId: string;
  provider: MarketplaceCode;
  accountId: string;
  externalAccountId: string | null;
  displayName: string;
  grantType: 'authorization_code' | 'client_credentials';
  scopes: string[];
  tokenExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
  status: OAuthCredentialStatus;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastRefreshAt: Date | null;
  lastError: string | null;
  lastSuccessAt: Date | null;
  keyVersion: number;
  createdAt: Date;
  updatedAt: Date;
  clientIdEnc: string;
  clientSecretEnc: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
}

export interface StoreCredentialInput {
  tenantId: string;
  provider: MarketplaceCode;
  accountId: string;
  displayName: string;
  grantType: 'authorization_code' | 'client_credentials';
  clientId: string;
  clientSecret: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  scopes?: string[];
  tokenExpiresAt?: Date | null;
  refreshExpiresAt?: Date | null;
  externalAccountId?: string | null;
  status?: OAuthCredentialStatus;
}

export interface TokenUpdateInput {
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt: Date;
  refreshExpiresAt?: Date | null;
  externalAccountId?: string | null;
  scopes?: string[];
}

export interface OAuthProviderConfig {
  code: MarketplaceCode;
  authorizationUrl: string;
  tokenUrl: string;
  defaultScopes: string[];
  supportsRefresh: boolean;
  supportsPkce: boolean;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string | null;
  tokenType: string;
}

export interface OAuthProviderAdapter {
  readonly config: OAuthProviderConfig;
  buildAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    scopes: string[];
    codeChallenge?: string;
  }): string;
  exchangeAuthorizationCode(params: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
  }): Promise<TokenExchangeResult>;
  exchangeClientCredentials(params: {
    clientId: string;
    clientSecret: string;
  }): Promise<TokenExchangeResult>;
  refreshAccessToken(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<TokenExchangeResult>;
  fetchAccountProfile(accessToken: string, baseUrl: string): Promise<{ externalAccountId: string; displayName: string }>;
}
