import type {
  NeekloPlugin,
  PluginContext,
  PluginHealth,
  PluginManifest,
  PluginState,
  PluginValidationResult,
  RegisteredPlugin,
} from './types';
import { PluginState as State } from './types';

export interface PluginRegistryOptions {
  minPlatformVersion?: string;
}

/**
 * Central plugin registry. Discovers, validates, installs, activates, updates, deactivates
 * and removes plugins without modifying platform core code.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, RegisteredPlugin>();
  private readonly minPlatformVersion: string;

  constructor(options: PluginRegistryOptions = {}) {
    this.minPlatformVersion = options.minPlatformVersion ?? '0.2.0';
  }

  /** Register a plugin instance (called at bootstrap or on install). */
  register(instance: NeekloPlugin, config: Record<string, unknown> = {}): RegisteredPlugin {
    const id = instance.manifest.id;
    if (this.plugins.has(id)) {
      throw new Error(`Plugin ${id} is already registered`);
    }
    const entry: RegisteredPlugin = {
      manifest: instance.manifest,
      instance,
      state: State.DISCOVERED,
      installedAt: new Date().toISOString(),
      activatedAt: null,
      lastError: null,
      config,
    };
    this.plugins.set(id, entry);
    return entry;
  }

  validate(manifest: PluginManifest): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.id || !manifest.version || !manifest.kind) {
      errors.push('manifest.id, version and kind are required');
    }
    if (manifest.minPlatformVersion > this.minPlatformVersion) {
      errors.push(
        `Plugin requires platform ${manifest.minPlatformVersion}, current is ${this.minPlatformVersion}`,
      );
    }
    for (const dep of manifest.dependencies ?? []) {
      if (!this.plugins.has(dep)) {
        warnings.push(`Dependency ${dep} is not installed`);
      }
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  async install(instance: NeekloPlugin, ctx: PluginContext): Promise<RegisteredPlugin> {
    const validation = this.validate(instance.manifest);
    if (!validation.valid) {
      throw new Error(`Plugin validation failed: ${validation.errors.join('; ')}`);
    }
    await instance.validate(instance.manifest);
    const entry = this.register(instance, ctx.config);
    try {
      await instance.onInstall(ctx);
      entry.state = State.INSTALLED;
    } catch (e) {
      entry.state = State.FAILED;
      entry.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    }
    return entry;
  }

  async activate(pluginId: string, ctx: PluginContext): Promise<void> {
    const entry = this.require(pluginId);
    if (entry.state !== State.INSTALLED && entry.state !== State.INACTIVE) {
      throw new Error(`Plugin ${pluginId} cannot be activated from state ${entry.state}`);
    }
    try {
      await entry.instance.onActivate(ctx);
      entry.state = State.ACTIVE;
      entry.activatedAt = new Date().toISOString();
      entry.lastError = null;
    } catch (e) {
      entry.state = State.FAILED;
      entry.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }

  async deactivate(pluginId: string, ctx: PluginContext): Promise<void> {
    const entry = this.require(pluginId);
    if (entry.state !== State.ACTIVE) return;
    await entry.instance.onDeactivate(ctx);
    entry.state = State.INACTIVE;
    entry.activatedAt = null;
  }

  async update(pluginId: string, ctx: PluginContext, fromVersion: string): Promise<void> {
    const entry = this.require(pluginId);
    entry.state = State.UPDATING;
    try {
      await entry.instance.onUpdate(ctx, fromVersion);
      entry.manifest = entry.instance.manifest;
      entry.state = State.ACTIVE;
    } catch (e) {
      entry.state = State.FAILED;
      entry.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }

  async uninstall(pluginId: string, ctx: PluginContext): Promise<void> {
    const entry = this.require(pluginId);
    if (entry.state === State.ACTIVE) {
      await this.deactivate(pluginId, ctx);
    }
    await entry.instance.onUninstall(ctx);
    entry.state = State.REMOVED;
    this.plugins.delete(pluginId);
  }

  get(pluginId: string): RegisteredPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  require(pluginId: string): RegisteredPlugin {
    const entry = this.plugins.get(pluginId);
    if (!entry) throw new Error(`Plugin ${pluginId} not found`);
    return entry;
  }

  list(filter?: { kind?: string; state?: PluginState }): RegisteredPlugin[] {
    return [...this.plugins.values()].filter((p) => {
      if (filter?.kind && p.manifest.kind !== filter.kind) return false;
      if (filter?.state && p.state !== filter.state) return false;
      return p.state !== State.REMOVED;
    });
  }

  async healthCheck(pluginId: string): Promise<PluginHealth> {
    return this.require(pluginId).instance.healthCheck();
  }

  async healthCheckAll(): Promise<Map<string, PluginHealth>> {
    const results = new Map<string, PluginHealth>();
    for (const [id, entry] of this.plugins) {
      if (entry.state === State.ACTIVE) {
        results.set(id, await entry.instance.healthCheck());
      }
    }
    return results;
  }
}
