import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  AvitoAiWatcherCreateDto,
  AvitoAiWatcherDto,
  AvitoAutomationRuleDto,
  AvitoAutomationRuleUpsertDto,
  AvitoAiReportDto,
  AvitoContentRecommendationDto,
  AvitoExecutiveAiDto,
  AvitoNotificationPolicyDto,
  AvitoNotificationPolicyUpsertDto,
  AvitoObservatoryDto,
  AvitoOpportunityItemDto,
  AvitoPriceRecommendationDto,
} from '@neeklo/contracts';

export function useAvitoAutomationWatchers() {
  return useQuery({
    queryKey: ['avito-automation', 'watchers'],
    queryFn: () => api.get<AvitoAiWatcherDto[]>('/avito/automation/watchers'),
    refetchInterval: 60_000,
  });
}

export function useAvitoAutomationCreateWatcher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoAiWatcherCreateDto) => api.post<AvitoAiWatcherDto>('/avito/automation/watchers', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-automation'] }),
  });
}

export function useAvitoAutomationEvaluateWatchers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/avito/automation/watchers/evaluate'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-automation'] }),
  });
}

export function useAvitoAutomationRules() {
  return useQuery({
    queryKey: ['avito-automation', 'rules'],
    queryFn: () => api.get<AvitoAutomationRuleDto[]>('/avito/automation/rules'),
  });
}

export function useAvitoAutomationUpsertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoAutomationRuleUpsertDto) => api.put<AvitoAutomationRuleDto>('/avito/automation/rules', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-automation', 'rules'] }),
  });
}

export function useAvitoAutomationObservatory() {
  return useQuery({
    queryKey: ['avito-automation', 'observatory'],
    queryFn: () => api.get<AvitoObservatoryDto>('/avito/automation/observatory'),
    refetchInterval: 30_000,
  });
}

export function useAvitoAutomationOpportunities() {
  return useQuery({
    queryKey: ['avito-automation', 'opportunities'],
    queryFn: () => api.get<AvitoOpportunityItemDto[]>('/avito/automation/opportunities'),
    refetchInterval: 60_000,
  });
}

export function useAvitoAutomationPrice() {
  return useQuery({
    queryKey: ['avito-automation', 'price'],
    queryFn: () => api.get<AvitoPriceRecommendationDto[]>('/avito/automation/price'),
  });
}

export function useAvitoAutomationContent() {
  return useQuery({
    queryKey: ['avito-automation', 'content'],
    queryFn: () => api.get<AvitoContentRecommendationDto[]>('/avito/automation/content'),
  });
}

export function useAvitoAutomationNotificationPolicies() {
  return useQuery({
    queryKey: ['avito-automation', 'notification-policies'],
    queryFn: () => api.get<AvitoNotificationPolicyDto[]>('/avito/automation/notification-policies'),
  });
}

export function useAvitoAutomationUpsertNotificationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoNotificationPolicyUpsertDto) =>
      api.put<AvitoNotificationPolicyDto>('/avito/automation/notification-policies', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-automation', 'notification-policies'] }),
  });
}

export function useAvitoAutomationReports() {
  return useQuery({
    queryKey: ['avito-automation', 'reports'],
    queryFn: () => api.get<AvitoAiReportDto[]>('/avito/automation/reports'),
  });
}

export function useAvitoAutomationLatestReport() {
  return useQuery({
    queryKey: ['avito-automation', 'reports', 'latest'],
    queryFn: () => api.get<AvitoAiReportDto | null>('/avito/automation/reports/latest'),
  });
}

export function useAvitoAutomationExecutive() {
  return useQuery({
    queryKey: ['avito-automation', 'executive'],
    queryFn: () => api.get<AvitoExecutiveAiDto>('/avito/automation/executive'),
    refetchInterval: 120_000,
  });
}

export function useAvitoAutomationRunAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/avito/automation/run-all'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-automation'] }),
  });
}

export function useAvitoAutomationGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AvitoAiReportDto>('/avito/automation/reports/generate'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-automation', 'reports'] }),
  });
}

export function useAvitoAutomationGeneratePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/avito/automation/price/generate'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-automation', 'price'] }),
  });
}

export function useAvitoAutomationScanOpportunities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/avito/automation/opportunities/scan'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-automation', 'opportunities'] }),
  });
}
