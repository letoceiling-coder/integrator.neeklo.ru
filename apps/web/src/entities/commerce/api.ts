import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  ConversationReadModel,
  CustomerReadModel,
  DealReadModel,
  MessageReadModel,
  TaskReadModel,
  NotificationReadModel,
} from '@neeklo/contracts';

export function useInbox(filters?: { status?: string; q?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.q) params.set('q', filters.q);
  return useQuery({
    queryKey: ['commerce', 'inbox', filters],
    queryFn: () => api.get<ConversationReadModel[]>(`/commerce/inbox?${params}`),
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['commerce', 'messages', conversationId],
    enabled: !!conversationId,
    queryFn: () => api.get<MessageReadModel[]>(`/commerce/inbox/${conversationId}/messages`),
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.post(`/commerce/inbox/${conversationId}/send`, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commerce', 'messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['commerce', 'inbox'] });
    },
  });
}

export function useAgentReply() {
  return useMutation({
    mutationFn: (body: { conversationId: string; customerId: string; adId?: string | null; message: string; autoSend?: boolean }) =>
      api.post<{ draft: string; confidence: number; actions: { type: string; reason: string }[] }>('/commerce/agent/reply', body),
  });
}

export function useCustomers(q?: string) {
  return useQuery({
    queryKey: ['commerce', 'customers', q],
    queryFn: () => api.get<CustomerReadModel[]>(`/commerce/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });
}

export function useCustomer360(id: string | null) {
  return useQuery({
    queryKey: ['commerce', 'customer', id],
    enabled: !!id,
    queryFn: () => api.get(`/commerce/customers/${id}`),
  });
}

export function useDealsPipeline() {
  return useQuery({
    queryKey: ['commerce', 'deals'],
    queryFn: () => api.get<{ stage: string; deals: DealReadModel[]; count: number }[]>('/commerce/deals'),
  });
}

export function useBudget() {
  return useQuery({
    queryKey: ['commerce', 'budget'],
    queryFn: () => api.get('/commerce/budget'),
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ['commerce', 'regions'],
    queryFn: () => api.get('/commerce/regions'),
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ['commerce', 'tasks'],
    queryFn: () => api.get<TaskReadModel[]>('/commerce/tasks'),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['commerce', 'notifications'],
    queryFn: () => api.get<NotificationReadModel[]>('/commerce/notifications?unread=true'),
  });
}

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: ['commerce', 'search', q],
    enabled: q.length >= 2,
    queryFn: () => api.get(`/commerce/search?q=${encodeURIComponent(q)}`),
  });
}

export function useTimeline() {
  return useQuery({
    queryKey: ['commerce', 'timeline'],
    queryFn: () => api.get('/commerce/timeline'),
  });
}

export function useAutomations() {
  return useQuery({
    queryKey: ['commerce', 'automations'],
    queryFn: () => api.get('/commerce/automations'),
  });
}

export function useListingStudio(adId: string | null) {
  return useQuery({
    queryKey: ['commerce', 'listing-studio', adId],
    enabled: !!adId,
    queryFn: () => api.get(`/commerce/listings/${adId}/studio`),
  });
}
