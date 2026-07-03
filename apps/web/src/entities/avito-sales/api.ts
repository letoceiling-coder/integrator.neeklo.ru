import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type {
  AvitoCustomer360Dto,
  AvitoDealAnalysisDto,
  AvitoLeadDto,
  AvitoPipelineColumnDto,
  AvitoPipelineMoveDto,
  AvitoSalesAgentConfigDto,
  AvitoSalesDashboardDto,
  AvitoSmartInboxDto,
  AvitoSmartReplyDto,
  AvitoSmartReplyRequestDto,
  AvitoCreateTaskDto,
  AvitoDocumentCreateDto,
} from '@neeklo/contracts';

export function useAvitoSalesLeads(stage?: string) {
  return useQuery({
    queryKey: ['avito-sales', 'leads', stage],
    queryFn: () => api.get<AvitoLeadDto[]>(`/avito/sales/leads${stage ? `?stage=${stage}` : ''}`),
    refetchInterval: 30_000,
  });
}

export function useAvitoSalesPipeline() {
  return useQuery({
    queryKey: ['avito-sales', 'pipeline'],
    queryFn: () => api.get<AvitoPipelineColumnDto[]>('/avito/sales/pipeline'),
    refetchInterval: 30_000,
  });
}

export function useAvitoSalesMovePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoPipelineMoveDto) => api.put('/avito/sales/pipeline/move', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-sales'] }),
  });
}

export function useAvitoSalesInbox(conversationId?: string) {
  return useQuery({
    queryKey: ['avito-sales', 'inbox', conversationId],
    queryFn: () =>
      api.get<AvitoSmartInboxDto>(`/avito/sales/inbox${conversationId ? `?conversationId=${conversationId}` : ''}`),
    refetchInterval: 15_000,
  });
}

export function useAvitoSalesCustomer360(customerId?: string) {
  return useQuery({
    queryKey: ['avito-sales', '360', customerId],
    enabled: !!customerId,
    queryFn: () => api.get<AvitoCustomer360Dto>(`/avito/sales/customers/${customerId}/360`),
  });
}

export function useAvitoSalesSmartReplies() {
  return useMutation({
    mutationFn: (body: AvitoSmartReplyRequestDto) => api.post<AvitoSmartReplyDto[]>('/avito/sales/smart-replies', body),
  });
}

export function useAvitoSalesAgentConfig(accountId?: string) {
  return useQuery({
    queryKey: ['avito-sales', 'agent-config', accountId],
    enabled: !!accountId,
    queryFn: () => api.get<AvitoSalesAgentConfigDto>(`/avito/sales/agent/config?accountId=${accountId}`),
  });
}

export function useAvitoSalesUpdateAgentConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoSalesAgentConfigDto) => api.put('/avito/sales/agent/config', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-sales', 'agent-config'] }),
  });
}

export function useAvitoSalesDashboard() {
  return useQuery({
    queryKey: ['avito-sales', 'dashboard'],
    queryFn: () => api.get<AvitoSalesDashboardDto>('/avito/sales/dashboard'),
    refetchInterval: 60_000,
  });
}

export function useAvitoSalesTasks() {
  return useQuery({
    queryKey: ['avito-sales', 'tasks'],
    queryFn: () => api.get('/avito/sales/tasks'),
  });
}

export function useAvitoSalesCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoCreateTaskDto) => api.post('/avito/sales/tasks', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-sales', 'tasks'] }),
  });
}

export function useAvitoSalesCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['avito-sales', 'calendar', from, to],
    queryFn: () => api.get(`/avito/sales/calendar?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
}

export function useAvitoSalesDocuments() {
  return useQuery({
    queryKey: ['avito-sales', 'documents'],
    queryFn: () => api.get('/avito/sales/documents'),
  });
}

export function useAvitoSalesCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AvitoDocumentCreateDto) => api.post('/avito/sales/documents', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-sales', 'documents'] }),
  });
}

export function useAvitoSalesDealAnalysis(dealId?: string) {
  return useQuery({
    queryKey: ['avito-sales', 'analysis', dealId],
    enabled: !!dealId,
    queryFn: () => api.get<AvitoDealAnalysisDto>(`/avito/sales/deals/${dealId}/analysis`),
  });
}

export function useAvitoSalesNotifications(unread?: boolean) {
  return useQuery({
    queryKey: ['avito-sales', 'notifications', unread],
    queryFn: () => api.get(`/avito/sales/notifications${unread ? '?unread=true' : ''}`),
    refetchInterval: 30_000,
  });
}

export function useAvitoSalesAgentReply() {
  return useMutation({
    mutationFn: (body: { conversationId: string; customerId: string; adId?: string | null; message: string; autoSend?: boolean; accountId?: string }) =>
      api.post('/avito/sales/agent/reply', body),
  });
}

export function useAvitoSalesSyncMessenger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.post(`/avito/sales/sync/messenger?accountId=${accountId}`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avito-sales'] }),
  });
}
