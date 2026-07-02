/** Plugin kinds supported by the NEEKLO platform. Each kind has its own lifecycle hooks. */
export const PluginKind = {
  MARKETPLACE: 'marketplace',
  AI: 'ai',
  WORKFLOW: 'workflow',
  ANALYTICS: 'analytics',
  NOTIFICATION: 'notification',
  MEDIA: 'media',
  EXPORT: 'export',
  IMPORT: 'import',
  CONNECTOR: 'connector',
} as const;

export type PluginKind = (typeof PluginKind)[keyof typeof PluginKind];

export const PluginState = {
  DISCOVERED: 'discovered',
  INSTALLED: 'installed',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UPDATING: 'updating',
  FAILED: 'failed',
  REMOVED: 'removed',
} as const;

export type PluginState = (typeof PluginState)[keyof typeof PluginState];

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  kind: PluginKind;
  description: string;
  author: string;
  minPlatformVersion: string;
  /** Entry point module path (for dynamic loading in future; today: registered in DI). */
  entry?: string;
  dependencies?: string[];
  configSchema?: Record<string, unknown>;
  permissions?: string[];
}

export interface PluginHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  checkedAt: string;
  details?: Record<string, unknown>;
}

export interface PluginContext {
  organizationId: string | null;
  correlationId: string;
  config: Record<string, unknown>;
  logger: PluginLogger;
  emit(event: string, payload: Record<string, unknown>): void;
}

export interface PluginLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Every NEEKLO plugin implements this contract. The runtime drives install → activate →
 * deactivate → uninstall without the core knowing plugin internals.
 */
export interface NeekloPlugin {
  readonly manifest: PluginManifest;

  validate(manifest: PluginManifest): Promise<void>;
  onInstall(ctx: PluginContext): Promise<void>;
  onActivate(ctx: PluginContext): Promise<void>;
  onDeactivate(ctx: PluginContext): Promise<void>;
  onUpdate(ctx: PluginContext, fromVersion: string): Promise<void>;
  onUninstall(ctx: PluginContext): Promise<void>;
  healthCheck(): Promise<PluginHealth>;
}

export interface RegisteredPlugin {
  manifest: PluginManifest;
  instance: NeekloPlugin;
  state: PluginState;
  installedAt: string;
  activatedAt: string | null;
  lastError: string | null;
  config: Record<string, unknown>;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
