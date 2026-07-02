import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AiCostSummaryDto, AiRunResponseDto, AgentReadModel } from '@neeklo/contracts';

export type AiTaskType = 'chat' | 'analytics' | 'listing' | 'summary' | 'vision' | 'ocr';

export interface AiRunBody {
  taskType: AiTaskType;
  input: string;
  agentId?: string;
  skillIds?: string[];
  context?: Record<string, unknown>;
  maxSteps?: number;
}

export function useAiRun() {
  return useMutation({
    mutationFn: (body: AiRunBody) => api.post<AiRunResponseDto>('/ai/run', body),
  });
}

export function useAiDashboard() {
  return useQuery({
    queryKey: ['ai', 'dashboard'],
    queryFn: () =>
      api.get<{
        cost: AiCostSummaryDto;
        health: { runs24h: number; avgLatencyMs: number; errorRate: number };
        agents: number;
        recentRuns: { id: string; taskType: string; status: string; costUsd: number; startedAt: string }[];
      }>('/ai/dashboard'),
  });
}

export function useAiCost() {
  return useQuery({
    queryKey: ['ai', 'cost'],
    queryFn: () => api.get<AiCostSummaryDto>('/ai/cost'),
  });
}

export function useAiAgents() {
  return useQuery({
    queryKey: ['ai', 'agents'],
    queryFn: () => api.get<AgentReadModel[]>('/ai/agents'),
  });
}

export function useAiSkills() {
  return useQuery({
    queryKey: ['ai', 'skills'],
    queryFn: () => api.get<{ skillId: string; name: string; category: string; description: string }[]>('/ai/skills'),
  });
}

export function useAiTools(category?: string) {
  return useQuery({
    queryKey: ['ai', 'tools', category],
    queryFn: () =>
      api.get<{ name: string; category: string; description: string; version: string }[]>(
        `/ai/tools${category ? `?category=${encodeURIComponent(category)}` : ''}`,
      ),
  });
}

export function useAiRuns(limit = 20) {
  return useQuery({
    queryKey: ['ai', 'runs', limit],
    queryFn: () =>
      api.get<
        {
          id: string;
          taskType: string;
          model: string;
          status: string;
          costUsd: number;
          latencyMs: number | null;
          startedAt: string;
        }[]
      >(`/ai/runs?limit=${limit}`),
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      role?: string;
      skillIds?: string[];
      toolNames?: string[];
    }) => api.post<{ id: string }>('/ai/agents', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'agents'] }),
  });
}

export function useAiObservability() {
  return useQuery({
    queryKey: ['ai', 'observability'],
    queryFn: () =>
      api.get<{ runs24h: number; avgLatencyMs: number; errorRate: number; toolInvocations: number }>(
        '/ai/observability',
      ),
  });
}

export function useAiLearning() {
  return useQuery({
    queryKey: ['ai', 'learning'],
    queryFn: () =>
      api.get<{ id: string; category: string; insight: string; confidence: number; recordedAt: string }[]>(
        '/ai/learning',
      ),
  });
}
