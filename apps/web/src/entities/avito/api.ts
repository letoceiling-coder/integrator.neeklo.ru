import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  AvitoAccountReadModel,
  AvitoAnalyticsSummaryDto,
  ListingPipelineReadModel,
  KnowledgeDocumentReadModel,
} from '@neeklo/contracts';

export function useAvitoDashboard() {
  return useQuery({
    queryKey: ['avito', 'dashboard'],
    queryFn: () =>
      api.get<{
        accounts: number;
        analytics: AvitoAnalyticsSummaryDto;
        budget: unknown;
        knowledgeDocs: number;
      }>('/avito/dashboard'),
  });
}

export function useAvitoAccounts() {
  return useQuery({
    queryKey: ['avito', 'accounts'],
    queryFn: () => api.get<AvitoAccountReadModel[]>('/avito/accounts'),
  });
}

export function useAvitoAds(filters?: { q?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.q) params.set('q', filters.q);
  if (filters?.status) params.set('status', filters.status);
  return useQuery({
    queryKey: ['avito', 'ads', filters],
    queryFn: () => api.get(`/avito/ads?${params}`),
  });
}

export function useAvitoAnalytics() {
  return useQuery({
    queryKey: ['avito', 'analytics'],
    queryFn: () => api.get<AvitoAnalyticsSummaryDto>('/avito/analytics/summary'),
  });
}

export function useAvitoBudget() {
  return useQuery({
    queryKey: ['avito', 'budget'],
    queryFn: () => api.get('/avito/budget'),
  });
}

export function useListingGenerate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { product: string; categoryId?: string; regionId?: string; createDraft?: boolean }) =>
      api.post<ListingPipelineReadModel & { pipelineId: string; adId: string | null }>('/avito/listing/generate', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avito', 'listing'] }),
  });
}

export function useListingPipelines() {
  return useQuery({
    queryKey: ['avito', 'listing'],
    queryFn: () => api.get<ListingPipelineReadModel[]>('/avito/listing/pipelines'),
  });
}

export function useRegionalPublish() {
  return useMutation({
    mutationFn: (body: {
      basePrice: number;
      regions: { regionId: string; cityId: string }[];
      product?: string;
      sourceAdId?: string;
    }) => api.post('/avito/regional/publish', body),
  });
}

export function useKnowledgeDocs() {
  return useQuery({
    queryKey: ['avito', 'knowledge'],
    queryFn: () => api.get<KnowledgeDocumentReadModel[]>('/avito/knowledge'),
  });
}

export function useKnowledgeUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; category: string; content: string }) => api.post('/avito/knowledge', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avito', 'knowledge'] }),
  });
}

export function useAvitoNotifications(unread?: boolean) {
  return useQuery({
    queryKey: ['avito', 'notifications', unread],
    queryFn: () => api.get(`/avito/notifications${unread ? '?unread=true' : ''}`),
  });
}

export function useMediaAssets(kind?: string) {
  return useQuery({
    queryKey: ['avito', 'media', kind],
    queryFn: () => api.get(`/avito/media/assets${kind ? `?kind=${kind}` : ''}`),
  });
}

export function useBudgetImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { amount: number; category: string; adId?: string; note?: string }) =>
      api.post('/avito/budget/import', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['avito', 'budget'] });
    },
  });
}

export function useSyncAvitoAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.post(`/avito/accounts/${accountId}/sync`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avito', 'accounts'] }),
  });
}
