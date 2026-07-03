import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  AvitoBackupExportDto,
  AvitoInstallationWizardDto,
  AvitoLiveTestResultDto,
  AvitoPermissionsDto,
  AvitoProductionMonitorDto,
  AvitoProductionReadinessDto,
  AvitoRuntimeMode,
  AvitoRuntimeModeUpdateDto,
  AvitoFeedValidationDto,
  AvitoMessengerSendResultDto,
} from '@neeklo/contracts';

export function useAvitoProductionReadiness(accountId?: string) {
  return useQuery({
    queryKey: ['avito-production', 'readiness', accountId],
    enabled: !!accountId,
    queryFn: () => api.get<AvitoProductionReadinessDto>(`/avito/production/readiness?accountId=${accountId}`),
    refetchInterval: 60_000,
  });
}

export function useAvitoProductionMonitor(accountId?: string) {
  return useQuery({
    queryKey: ['avito-production', 'monitor', accountId],
    enabled: !!accountId,
    queryFn: () => api.get<AvitoProductionMonitorDto>(`/avito/production/monitor?accountId=${accountId}`),
    refetchInterval: 30_000,
  });
}

export function useAvitoProductionMode() {
  return useQuery({
    queryKey: ['avito-production', 'mode'],
    queryFn: () => api.get<AvitoRuntimeMode>('/avito/production/mode'),
  });
}

export function useAvitoProductionSetMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoRuntimeModeUpdateDto) => api.put('/avito/production/mode', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-production'] }),
  });
}

export function useAvitoProductionPermissions(accountId?: string) {
  return useQuery({
    queryKey: ['avito-production', 'permissions', accountId],
    enabled: !!accountId,
    queryFn: () => api.get<AvitoPermissionsDto>(`/avito/production/permissions?accountId=${accountId}`),
  });
}

export function useAvitoProductionWizard() {
  return useQuery({
    queryKey: ['avito-production', 'wizard'],
    queryFn: () => api.get<AvitoInstallationWizardDto>('/avito/production/wizard'),
  });
}

export function useAvitoProductionWizardStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (step: number) => api.post<AvitoInstallationWizardDto>('/avito/production/wizard/step', { step }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-production', 'wizard'] }),
  });
}

export function useAvitoProductionBackupExport() {
  return useMutation({
    mutationFn: () => api.get<AvitoBackupExportDto>('/avito/production/backup/export'),
  });
}

export function useAvitoProductionFeedValidate(accountId?: string) {
  return useQuery({
    queryKey: ['avito-production', 'feed-validate', accountId],
    enabled: !!accountId,
    queryFn: () => api.get<AvitoFeedValidationDto>(`/avito/production/feed/validate?accountId=${accountId}`),
  });
}

export function useAvitoProductionLiveTest() {
  return useMutation({
    mutationFn: ({ accountId, component }: { accountId: string; component: string }) =>
      api.post<AvitoLiveTestResultDto>(`/avito/production/test/${component}?accountId=${accountId}`),
  });
}

export function useAvitoProductionMessengerSend() {
  return useMutation({
    mutationFn: (body: { conversationId: string; text: string }) =>
      api.post<AvitoMessengerSendResultDto>('/avito/production/messenger/send', body),
  });
}
