import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthTokens, CurrentUser, LoginDto } from '@neeklo/contracts';
import { api, tokenStore } from '@/shared/api/client';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => api.get<CurrentUser>('/auth/me', undefined, signal),
    enabled: Boolean(tokenStore.get()),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: LoginDto) => api.post<AuthTokens>('/auth/login', dto),
    onSuccess: (tokens) => {
      tokenStore.set(tokens.accessToken);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function logout(): void {
  tokenStore.clear();
  window.location.href = '/login';
}
