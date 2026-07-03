import { z } from 'zod';

export const AvitoRuntimeMode = {
  Sandbox: 'sandbox',
  Production: 'production',
} as const;
export type AvitoRuntimeMode = (typeof AvitoRuntimeMode)[keyof typeof AvitoRuntimeMode];

export const avitoRuntimeModeSchema = z.enum(['sandbox', 'production']);

export interface AvitoProductionCheckItemDto {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  message: string;
  latencyMs?: number;
}

export interface AvitoProductionReadinessDto {
  ready: boolean;
  score: number;
  mode: AvitoRuntimeMode;
  items: AvitoProductionCheckItemDto[];
  checkedAt: string;
}

export interface AvitoProductionMonitorDto {
  errors24h: number;
  avgLatencyMs: number;
  retries24h: number;
  rateLimit429: number;
  webhookFailures24h: number;
  syncLagSec: number | null;
  queueDepth: number;
  storageOk: boolean;
  workers: { name: string; status: string; lastRunAt: string | null }[];
  checkedAt: string;
}

export interface AvitoApiPermissionDto {
  scope: string;
  granted: boolean;
  available: boolean;
  message: string;
}

export interface AvitoPermissionsDto {
  grantedScopes: string[];
  tariff: string;
  permissions: AvitoApiPermissionDto[];
  unavailableApis: string[];
}

export interface AvitoInstallationWizardDto {
  currentStep: number;
  totalSteps: number;
  steps: { id: number; label: string; status: 'pending' | 'done' | 'active' | 'skipped' }[];
  ready: boolean;
}

export interface AvitoBackupExportDto {
  exportedAt: string;
  sections: string[];
  payload: Record<string, unknown>;
}

export const avitoRuntimeModeUpdateSchema = z.object({
  mode: avitoRuntimeModeSchema,
});
export type AvitoRuntimeModeUpdateDto = z.infer<typeof avitoRuntimeModeUpdateSchema>;

export const avitoWizardStepSchema = z.object({
  step: z.number().int().min(1).max(10),
});
export type AvitoWizardStepDto = z.infer<typeof avitoWizardStepSchema>;

export interface AvitoFeedValidationDto {
  valid: boolean;
  errors: string[];
  warnings: string[];
  adCount: number;
  xmlPreview?: string;
}

export interface AvitoMessengerSendResultDto {
  sent: boolean;
  mode: AvitoRuntimeMode;
  message: string;
  avitoMessageId?: string;
}

export interface AvitoLiveTestResultDto {
  component: string;
  ok: boolean;
  mode: AvitoRuntimeMode;
  latencyMs: number;
  message: string;
}
