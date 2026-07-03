import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  AvitoAccountOverviewDto,
  AvitoApiUsageDto,
  AvitoExplorerNodeDto,
  AvitoLiveHealthDto,
  AvitoSyncDashboardDto,
  AvitoSyncInspectorEntryDto,
  AvitoSyncScheduleUpdateDto,
  AvitoTimelineEntryDto,
  AvitoWebhookCenterDto,
} from '@neeklo/contracts';

export function useAvitoLiveDashboard(accountId?: string) {
  return useQuery({
    queryKey: ['avito-live', 'dashboard', accountId],
    queryFn: () => api.get<AvitoSyncDashboardDto>(`/avito/live/dashboard?accountId=${accountId}`),
    enabled: !!accountId,
    refetchInterval: 30_000,
  });
}

export function useAvitoLiveOverview(accountId?: string) {
  return useQuery({
    queryKey: ['avito-live', 'overview', accountId],
    queryFn: () => api.get<AvitoAccountOverviewDto>(`/avito/live/overview?accountId=${accountId}`),
    enabled: !!accountId,
  });
}

export function useAvitoLiveExplorer(accountId?: string) {
  return useQuery({
    queryKey: ['avito-live', 'explorer', accountId],
    queryFn: () => api.get<AvitoExplorerNodeDto>(`/avito/live/explorer?accountId=${accountId}`),
    enabled: !!accountId,
  });
}

export function useAvitoLiveUsage() {
  return useQuery({
    queryKey: ['avito-live', 'usage'],
    queryFn: () => api.get<AvitoApiUsageDto>('/avito/live/usage'),
    refetchInterval: 60_000,
  });
}

export function useAvitoLiveWebhooks(accountId?: string) {
  return useQuery({
    queryKey: ['avito-live', 'webhooks', accountId],
    queryFn: () => api.get<AvitoWebhookCenterDto>(`/avito/live/webhooks?accountId=${accountId}`),
    enabled: !!accountId,
  });
}

export function useAvitoLiveTimeline(accountId?: string) {
  return useQuery({
    queryKey: ['avito-live', 'timeline', accountId],
    queryFn: () => api.get<AvitoTimelineEntryDto[]>(`/avito/live/timeline?accountId=${accountId}`),
    enabled: !!accountId,
    refetchInterval: 30_000,
  });
}

export function useAvitoLiveInspector(accountId?: string) {
  return useQuery({
    queryKey: ['avito-live', 'inspector', accountId],
    queryFn: () => api.get<AvitoSyncInspectorEntryDto[]>(`/avito/live/inspector?accountId=${accountId}`),
    enabled: !!accountId,
  });
}

export function useAvitoLiveHealth(accountId?: string) {
  return useQuery({
    queryKey: ['avito-live', 'health', accountId],
    queryFn: () => api.get<AvitoLiveHealthDto>(`/avito/live/health?accountId=${accountId}`),
    enabled: !!accountId,
    refetchInterval: 60_000,
  });
}

export function useAvitoLiveSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.post<AvitoSyncDashboardDto>(`/avito/live/sync?accountId=${accountId}`, {}),
    onSuccess: (_d, accountId) => {
      void qc.invalidateQueries({ queryKey: ['avito-live'] });
      void qc.invalidateQueries({ queryKey: ['avito-live', 'dashboard', accountId] });
    },
  });
}

export function useAvitoLiveScheduleUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoSyncScheduleUpdateDto) => api.put('/avito/live/schedule', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-live'] }),
  });
}

export function useAvitoLiveWebhookTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.post(`/avito/live/webhooks/test?accountId=${accountId}`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-live', 'webhooks'] }),
  });
}
