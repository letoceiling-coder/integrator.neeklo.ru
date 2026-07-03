import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  AvitoConnectDto,
  OAuthAccountStatusDto,
  OAuthApiLogEntry,
  OAuthConfigDto,
  OAuthConnectResponse,
  OAuthDebugInfoDto,
  OAuthHealthDashboardDto,
  OAuthProductionChecklistDto,
  OAuthTestAction,
  OAuthTestResultDto,
  OAuthValidationSuiteResult,
  OAuthConnectionReportDto,
  OAuthIntegrationDashboardDto,
} from '@neeklo/contracts';

export function useOAuthAvitoAccounts() {
  return useQuery({
    queryKey: ['oauth', 'avito', 'accounts'],
    queryFn: () => api.get<OAuthAccountStatusDto[]>('/auth/avito/accounts'),
  });
}

export function useOAuthConfig() {
  return useQuery({
    queryKey: ['oauth', 'config'],
    queryFn: () => api.get<OAuthConfigDto>('/auth/os/config'),
  });
}

export function useOAuthDebug(accountId: string | undefined) {
  return useQuery({
    queryKey: ['oauth', 'debug', accountId],
    queryFn: () => api.get<OAuthDebugInfoDto>(`/auth/os/debug?accountId=${accountId}`),
    enabled: Boolean(accountId),
  });
}

export function useOAuthValidation(accountId: string | undefined) {
  return useQuery({
    queryKey: ['oauth', 'validate', accountId],
    queryFn: () =>
      api.post<OAuthValidationSuiteResult>(
        `/auth/os/validate${accountId ? `?accountId=${accountId}` : ''}`,
        {},
      ),
    enabled: false,
  });
}

export function useOAuthHealth(accountId: string | undefined) {
  return useQuery({
    queryKey: ['oauth', 'health', accountId],
    queryFn: () => api.get<OAuthHealthDashboardDto>(`/auth/os/health?accountId=${accountId}`),
    enabled: Boolean(accountId),
    refetchInterval: 30_000,
  });
}

export function useOAuthChecklist(accountId: string | undefined) {
  return useQuery({
    queryKey: ['oauth', 'checklist', accountId],
    queryFn: () => api.get<OAuthProductionChecklistDto>(`/auth/os/checklist?accountId=${accountId}`),
    enabled: Boolean(accountId),
  });
}

export function useOAuthConsole() {
  return useQuery({
    queryKey: ['oauth', 'console'],
    queryFn: () => api.get<OAuthApiLogEntry[]>('/auth/os/console?limit=50'),
    refetchInterval: 10_000,
  });
}

export function useConnectAvitoOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoConnectDto) => api.post<OAuthConnectResponse>('/auth/avito/connect', body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['oauth'] });
      qc.invalidateQueries({ queryKey: ['avito'] });
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    },
  });
}

export function useRefreshAvitoOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.post<OAuthAccountStatusDto>('/auth/avito/refresh', { accountId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oauth'] }),
  });
}

export function useDisconnectAvitoOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { accountId: string; reason?: string }) =>
      api.post('/auth/avito/disconnect', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oauth'] }),
  });
}

export function useOAuthTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { accountId: string; action: OAuthTestAction }) =>
      api.post<OAuthTestResultDto>('/auth/os/test', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oauth', 'console'] });
      qc.invalidateQueries({ queryKey: ['oauth', 'health'] });
    },
  });
}

export function useRunOAuthValidation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId?: string) =>
      api.post<OAuthValidationSuiteResult>(
        `/auth/os/validate${accountId ? `?accountId=${accountId}` : ''}`,
        {},
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oauth'] }),
  });
}

export function useOAuthConnectionReport(accountId: string | undefined) {
  return useQuery({
    queryKey: ['oauth', 'connection-report', accountId],
    queryFn: () => api.get<OAuthConnectionReportDto>(`/auth/os/connection-report?accountId=${accountId}`),
    enabled: Boolean(accountId),
    refetchInterval: 15_000,
  });
}

export function useOAuthIntegrationDashboard() {
  return useQuery({
    queryKey: ['oauth', 'integration-dashboard'],
    queryFn: () => api.get<OAuthIntegrationDashboardDto>('/auth/os/integration-dashboard'),
    refetchInterval: 30_000,
  });
}
