import { z } from 'zod';
import { marketplaceCodeSchema } from '../marketplace';

/** OAuth Platform domain events — credential lifecycle across all marketplaces. */
export const OAuthEventType = {
  OAuthConnected: 'oauth.connected',
  OAuthDisconnected: 'oauth.disconnected',
  TokenRefreshed: 'oauth.token_refreshed',
  TokenExpired: 'oauth.token_expired',
  TokenRefreshFailed: 'oauth.token_refresh_failed',
  CredentialUpdated: 'oauth.credential_updated',
  CredentialRemoved: 'oauth.credential_removed',
} as const;

export type OAuthEventType = (typeof OAuthEventType)[keyof typeof OAuthEventType];

export const OAuthCredentialStatus = {
  PENDING: 'pending',
  CONNECTED: 'connected',
  EXPIRED: 'expired',
  REAUTH_REQUIRED: 'reauth_required',
  DISCONNECTED: 'disconnected',
} as const;
export type OAuthCredentialStatus = (typeof OAuthCredentialStatus)[keyof typeof OAuthCredentialStatus];

export const oauthEventCatalog = {
  [OAuthEventType.OAuthConnected]: z.object({
    provider: marketplaceCodeSchema,
    accountId: z.string().uuid(),
    credentialId: z.string().uuid(),
    externalAccountId: z.string().nullable(),
    scopes: z.array(z.string()),
    grantType: z.enum(['authorization_code', 'client_credentials']),
    connectedAt: z.string().datetime(),
    tokenExpiresAt: z.string().datetime().nullable(),
  }),
  [OAuthEventType.OAuthDisconnected]: z.object({
    provider: marketplaceCodeSchema,
    accountId: z.string().uuid(),
    credentialId: z.string().uuid(),
    reason: z.string().nullable().default(null),
    disconnectedAt: z.string().datetime(),
  }),
  [OAuthEventType.TokenRefreshed]: z.object({
    provider: marketplaceCodeSchema,
    accountId: z.string().uuid(),
    credentialId: z.string().uuid(),
    tokenExpiresAt: z.string().datetime(),
    refreshedAt: z.string().datetime(),
  }),
  [OAuthEventType.TokenExpired]: z.object({
    provider: marketplaceCodeSchema,
    accountId: z.string().uuid(),
    credentialId: z.string().uuid(),
    expiredAt: z.string().datetime(),
  }),
  [OAuthEventType.TokenRefreshFailed]: z.object({
    provider: marketplaceCodeSchema,
    accountId: z.string().uuid(),
    credentialId: z.string().uuid(),
    error: z.string(),
    failedAt: z.string().datetime(),
  }),
  [OAuthEventType.CredentialUpdated]: z.object({
    provider: marketplaceCodeSchema,
    accountId: z.string().uuid(),
    credentialId: z.string().uuid(),
    fields: z.array(z.string()),
    updatedAt: z.string().datetime(),
  }),
  [OAuthEventType.CredentialRemoved]: z.object({
    provider: marketplaceCodeSchema,
    accountId: z.string().uuid(),
    credentialId: z.string().uuid(),
    removedAt: z.string().datetime(),
  }),
} as const;
