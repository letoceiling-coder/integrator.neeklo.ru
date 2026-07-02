import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdReadModel, ChangePriceDto, CreateAdDto, PageResponse } from '@neeklo/contracts';
import { api } from '@/shared/api/client';

export const adKeys = {
  all: ['ads'] as const,
  list: (filters: Record<string, unknown>) => [...adKeys.all, 'list', filters] as const,
  detail: (id: string) => [...adKeys.all, 'detail', id] as const,
};

export interface AdListFilters {
  status?: string;
  marketplace?: string;
  limit?: number;
}

export function useAds(filters: AdListFilters = {}) {
  return useQuery({
    queryKey: adKeys.list(filters),
    queryFn: ({ signal }) =>
      api.get<PageResponse<AdReadModel>>(
        '/ads',
        { status: filters.status, marketplace: filters.marketplace, limit: filters.limit ?? 50 },
        signal,
      ),
  });
}

export function useAd(id: string) {
  return useQuery({
    queryKey: adKeys.detail(id),
    queryFn: ({ signal }) => api.get<AdReadModel>(`/ads/${id}`, undefined, signal),
    enabled: Boolean(id),
  });
}

export function useCreateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAdDto) => api.post<{ id: string }>('/ads', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: adKeys.all }),
  });
}

export function useChangePrice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: ChangePriceDto) => api.patch<{ ok: true }>(`/ads/${id}/price`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: adKeys.all }),
  });
}
