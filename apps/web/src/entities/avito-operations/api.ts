import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  AvitoAdStudioDto,
  AvitoAdStudioUpdateDto,
  AvitoAdsFilterDto,
  AvitoAdsPageDto,
  AvitoBulkOperationDto,
  AvitoFeedExportDto,
  AvitoFeedStudioDto,
  AvitoMediaProJobDto,
  AvitoOperationsHealthDto,
  AvitoOperationsTimelineEntryDto,
  AvitoPromotionCenterDto,
  AvitoQualityReportDto,
} from '@neeklo/contracts';

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useAvitoOpsAds(filters: AvitoAdsFilterDto) {
  return useQuery({
    queryKey: ['avito-ops', 'ads', filters],
    queryFn: () =>
      api.get<AvitoAdsPageDto>(
        `/avito/operations/ads${qs({
          accountId: filters.accountId,
          q: filters.q,
          status: filters.status,
          categoryId: filters.categoryId,
          regionId: filters.regionId,
          cityId: filters.cityId,
          priceMin: filters.priceMin,
          priceMax: filters.priceMax,
          promotion: filters.promotion,
          autoload: filters.autoload,
          aiScoreMin: filters.aiScoreMin,
          contactsMin: filters.contactsMin,
          ctrMin: filters.ctrMin,
          groupId: filters.groupId,
          cursor: filters.cursor,
          limit: filters.limit ?? 100,
        })}`,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useAvitoOpsStudio(adId?: string) {
  return useQuery({
    queryKey: ['avito-ops', 'studio', adId],
    queryFn: () => api.get<AvitoAdStudioDto>(`/avito/operations/ads/${adId}/studio`),
    enabled: !!adId,
  });
}

export function useAvitoOpsQuality(adId?: string) {
  return useQuery({
    queryKey: ['avito-ops', 'quality', adId],
    queryFn: () => api.get<AvitoQualityReportDto>(`/avito/operations/ads/${adId}/quality`),
    enabled: !!adId,
  });
}

export function useAvitoOpsFeed(accountId?: string) {
  return useQuery({
    queryKey: ['avito-ops', 'feed', accountId],
    queryFn: () => api.get<AvitoFeedStudioDto>(`/avito/operations/feed?accountId=${accountId}`),
    enabled: !!accountId,
  });
}

export function useAvitoOpsPromotion(accountId?: string) {
  return useQuery({
    queryKey: ['avito-ops', 'promotion', accountId],
    queryFn: () => api.get<AvitoPromotionCenterDto>(`/avito/operations/promotion?accountId=${accountId}`),
    enabled: !!accountId,
  });
}

export function useAvitoOpsTimeline(opts: { adId?: string; accountId?: string }) {
  return useQuery({
    queryKey: ['avito-ops', 'timeline', opts],
    queryFn: () =>
      api.get<AvitoOperationsTimelineEntryDto[]>(
        `/avito/operations/timeline${qs({ adId: opts.adId, accountId: opts.accountId, limit: 100 })}`,
      ),
    refetchInterval: 30_000,
  });
}

export function useAvitoOpsHealth(accountId?: string) {
  return useQuery({
    queryKey: ['avito-ops', 'health', accountId],
    queryFn: () => api.get<AvitoOperationsHealthDto>(`/avito/operations/health${accountId ? `?accountId=${accountId}` : ''}`),
  });
}

export function useAvitoOpsRegionalDrafts(batchId?: string) {
  return useQuery({
    queryKey: ['avito-ops', 'regional', batchId],
    queryFn: () => api.get(`/avito/operations/regional/drafts${batchId ? `?batchId=${batchId}` : ''}`),
  });
}

export function useAvitoOpsMediaAssets(kind?: string) {
  return useQuery({
    queryKey: ['avito-ops', 'media', kind],
    queryFn: () => api.get(`/avito/operations/media/assets${kind ? `?kind=${kind}` : ''}`),
  });
}

export function useAvitoOpsUpdateStudio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ adId, body }: { adId: string; body: AvitoAdStudioUpdateDto }) =>
      api.put<AvitoAdStudioDto>(`/avito/operations/ads/${adId}/studio`, body),
    onSuccess: (_d, { adId }) => {
      void qc.invalidateQueries({ queryKey: ['avito-ops'] });
      void qc.invalidateQueries({ queryKey: ['avito-ops', 'studio', adId] });
    },
  });
}

export function useAvitoOpsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoBulkOperationDto) => api.post('/avito/operations/bulk', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-ops'] }),
  });
}

export function useAvitoOpsFeedExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoFeedExportDto) => api.post('/avito/operations/feed/export', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-ops', 'feed'] }),
  });
}

export function useAvitoOpsAiRewrite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adId: string) => api.post(`/avito/operations/ads/${adId}/ai-rewrite`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-ops'] }),
  });
}

export function useAvitoOpsMediaJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoMediaProJobDto) => api.post('/avito/operations/media/jobs', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-ops', 'media'] }),
  });
}
