import type { MarketplaceCode } from '@neeklo/contracts';
import type { MarketplaceProvider } from '@neeklo/marketplace-sdk';
import { PluginKind, PluginState, type NeekloPlugin, type PluginContext, RegisteredPlugin } from './types';
import { PluginRegistry } from './registry';

/**
 * Marketplace-specific registry layered on {@link PluginRegistry}.
 * Resolves {@link MarketplaceProvider} by marketplace code — the only lookup core code needs.
 */
export class MarketplaceRegistry {
  private readonly providers = new Map<MarketplaceCode, MarketplaceProvider>();
  private readonly codeByPluginId = new Map<string, MarketplaceCode>();

  constructor(private readonly pluginRegistry: PluginRegistry) {}

  registerProvider(pluginId: string, code: MarketplaceCode, provider: MarketplaceProvider): void {
    this.providers.set(code, provider);
    this.codeByPluginId.set(pluginId, code);
  }

  unregisterProvider(pluginId: string): void {
    const code = this.codeByPluginId.get(pluginId);
    if (code) {
      this.providers.delete(code);
      this.codeByPluginId.delete(pluginId);
    }
  }

  get(code: MarketplaceCode): MarketplaceProvider {
    const provider = this.providers.get(code);
    if (!provider) {
      throw new Error(`No marketplace provider registered for code: ${code}`);
    }
    return provider;
  }

  has(code: MarketplaceCode): boolean {
    return this.providers.has(code);
  }

  list(): MarketplaceProvider[] {
    return [...this.providers.values()];
  }

  listActivePlugins(): RegisteredPlugin[] {
    return this.pluginRegistry.list({ kind: PluginKind.MARKETPLACE, state: PluginState.ACTIVE });
  }
}

export interface MarketplacePluginBootstrap {
  plugin: NeekloPlugin;
  providerFactory: (ctx: PluginContext) => Promise<MarketplaceProvider> | MarketplaceProvider;
  marketplaceCode: MarketplaceCode;
}

/** Orchestrates marketplace plugin lifecycle: install → activate → register provider. */
export class MarketplacePluginRuntime {
  constructor(
    private readonly pluginRegistry: PluginRegistry,
    private readonly marketplaceRegistry: MarketplaceRegistry,
  ) {}

  async bootstrap(entry: MarketplacePluginBootstrap, ctx: PluginContext): Promise<void> {
    const { plugin, providerFactory, marketplaceCode } = entry;
    let registered = this.pluginRegistry.get(plugin.manifest.id);
    if (!registered) {
      registered = await this.pluginRegistry.install(plugin, ctx);
    }
    if (registered.state !== PluginState.ACTIVE) {
      await this.pluginRegistry.activate(plugin.manifest.id, ctx);
    }
    const provider = await providerFactory(ctx);
    this.marketplaceRegistry.registerProvider(plugin.manifest.id, marketplaceCode, provider);
  }

  async shutdown(pluginId: string, ctx: PluginContext): Promise<void> {
    this.marketplaceRegistry.unregisterProvider(pluginId);
    await this.pluginRegistry.deactivate(pluginId, ctx);
  }
}
