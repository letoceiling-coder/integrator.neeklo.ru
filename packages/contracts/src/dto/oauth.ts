import { z } from 'zod';
import { marketplaceCodeSchema } from '../marketplace';
import { OAuthCredentialStatus } from '../events/oauth-catalog';

export const avitoConnectSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scopes: z.array(z.string()).optional(),
  grantType: z.enum(['authorization_code', 'client_credentials']).default('authorization_code'),
});

export type AvitoConnectDto = z.infer<typeof avitoConnectSchema>;

export const avitoDisconnectSchema = z.object({
  accountId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type AvitoDisconnectDto = z.infer<typeof avitoDisconnectSchema>;

export const avitoRefreshSchema = z.object({
  accountId: z.string().uuid(),
});

export type AvitoRefreshDto = z.infer<typeof avitoRefreshSchema>;

export interface OAuthConnectResponse {
  accountId: string;
  credentialId: string;
  authorizationUrl?: string;
  state?: string;
  grantType: 'authorization_code' | 'client_credentials';
  status: OAuthCredentialStatus;
}

export interface OAuthAccountStatusDto {
  accountId: string;
  credentialId: string;
  provider: string;
  displayName: string;
  externalAccountId: string | null;
  status: OAuthCredentialStatus;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  scopes: string[];
  connected: boolean;
  tokenExpiresAt: string | null;
  refreshExpiresAt: string | null;
  lastRefreshAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastSyncAt: string | null;
  grantType: 'authorization_code' | 'client_credentials' | null;
}

export interface OAuthCallbackResult {
  success: boolean;
  accountId?: string;
  error?: string;
  redirectUrl: string;
}

export const oauthTestActionSchema = z.enum([
  'redirect',
  'token',
  'refresh',
  'profile',
  'account',
  'api',
]);

export type OAuthTestAction = z.infer<typeof oauthTestActionSchema>;

export const oauthTestSchema = z.object({
  accountId: z.string().uuid(),
  action: oauthTestActionSchema,
});

export type OAuthTestRequest = z.infer<typeof oauthTestSchema>;

export type OAuthCheckStatus = 'pass' | 'warn' | 'fail';

export interface OAuthValidationCheck {
  id: string;
  name: string;
  status: OAuthCheckStatus;
  message: string;
  latencyMs?: number;
}

export interface OAuthValidationSuiteResult {
  checks: OAuthValidationCheck[];
  passed: number;
  warned: number;
  failed: number;
  ranAt: string;
}

export interface OAuthDebugInfoDto {
  redirectUri: string;
  expectedRedirectUri: string;
  redirectMatch: boolean;
  provider: string;
  grantType: string;
  clientIdMasked: string;
  scopes: string[];
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  tokenExpiresAt: string | null;
  lastRefreshAt: string | null;
  lastError: string | null;
  pendingState: string | null;
  latencyMs: number | null;
  accountId: string;
  credentialId: string;
  externalAccountId: string | null;
  displayName: string;
}

export interface OAuthApiLogEntry {
  id: string;
  method: string;
  url: string;
  status: number;
  latencyMs: number;
  at: string;
  rateLimitRemaining: number | null;
  responsePreview: string;
}

export interface OAuthHealthDashboardDto {
  oauth: { status: OAuthCheckStatus; latencyMs: number; message: string };
  vault: { status: OAuthCheckStatus; keyVersion: number; message: string };
  provider: { status: OAuthCheckStatus; code: string; message: string };
  avitoApi: { status: OAuthCheckStatus; latencyMs: number; message: string };
  refresh: {
    status: OAuthCheckStatus;
    lastRefreshAt: string | null;
    expiresAt: string | null;
    message: string;
  };
  errors: { lastError: string | null; recentCount: number };
}

export interface OAuthProductionChecklistDto {
  oauth: OAuthCheckStatus;
  profile: OAuthCheckStatus;
  ads: OAuthCheckStatus;
  messenger: OAuthCheckStatus;
  stats: OAuthCheckStatus;
  webhook: OAuthCheckStatus;
  autoload: OAuthCheckStatus;
  health: OAuthCheckStatus;
  accountStatus: string;
}

export interface OAuthTestResultDto {
  ok: boolean;
  action: OAuthTestAction;
  latencyMs: number;
  data?: unknown;
  error?: string;
}

export interface OAuthProvisionResultDto {
  accountId: string;
  externalAccountId: string;
  displayName: string;
  itemsCount: number;
  accountStatus: string;
  checklist: OAuthProductionChecklistDto;
}

export interface OAuthConfigDto {
  redirectUri: string;
  expectedRedirectUri: string;
  callbackPath: string;
  productionCallbackUri: string;
  redirectMatch: boolean;
}

export interface OAuthSyncWizardStepDto {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'unavailable';
  message: string;
  latencyMs?: number;
  completedAt?: string;
}

export interface OAuthConnectionSectionDto {
  status: OAuthCheckStatus;
  message: string;
  latencyMs?: number;
  recommendation?: string;
  details?: unknown;
}

export interface OAuthConnectionAuditDto {
  oauth: boolean;
  tokenRefresh: boolean;
  profile: boolean;
  account: boolean;
  adsSynced: boolean;
  statsAvailable: boolean;
  messengerChecked: boolean;
  feedReady: boolean;
  webhookReady: boolean;
  productionHealth: boolean;
}

export interface OAuthConnectionReportDto {
  accountId: string;
  generatedAt: string;
  overallStatus: OAuthCheckStatus;
  audit: OAuthConnectionAuditDto;
  oauth: OAuthConnectionSectionDto & {
    validation?: OAuthValidationSuiteResult;
    checklist?: OAuthProductionChecklistDto;
  };
  account: {
    displayName: string;
    externalAccountId: string | null;
    companyName: string | null;
    accountType: string | null;
    status: string;
  };
  profile: OAuthConnectionSectionDto;
  tariff: OAuthConnectionSectionDto;
  scopes: string[];
  supportedApis: string[];
  apis: {
    messenger: OAuthConnectionSectionDto;
    statistics: OAuthConnectionSectionDto;
    autoload: OAuthConnectionSectionDto;
    promotion: OAuthConnectionSectionDto;
    core: OAuthConnectionSectionDto;
  };
  sync: {
    steps: OAuthSyncWizardStepDto[];
    adsCount: number;
    messagesCount: number;
    lastSyncAt: string | null;
    liveWorkers: { worker: string; status: string; lastError: string | null }[];
  };
  messenger: OAuthConnectionSectionDto & { chatCount?: number };
  feed: OAuthConnectionSectionDto & { valid?: boolean; version?: number; adCount?: number };
  webhook: OAuthConnectionSectionDto;
  health: OAuthHealthDashboardDto;
  latency: { profileMs: number | null; avgProbeMs: number | null };
  rateLimits: { remaining: number | null; requestsLastHour: number };
}

export interface OAuthIntegrationDashboardDto {
  accountId: string | null;
  connected: boolean;
  oauthStatus: OAuthCheckStatus;
  webhookStatus: OAuthCheckStatus;
  feedStatus: OAuthCheckStatus;
  adsCount: number;
  messagesCount: number;
  lastSyncAt: string | null;
  apiHealth: OAuthCheckStatus;
  overallStatus: OAuthCheckStatus;
}

