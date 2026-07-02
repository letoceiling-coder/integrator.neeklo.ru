import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { MarketplaceCode } from '@neeklo/contracts';
import type { MarketplaceProvider } from '@neeklo/marketplace-sdk';
import {
  MarketplaceRegistry,
  MarketplacePluginRuntime,
  PluginRegistry,
  type NeekloPlugin,
  type PluginContext,
} from '@neeklo/plugin-runtime';

/**
 * NestJS-facing marketplace registry. Wraps {@link PluginRegistry} + {@link MarketplaceRegistry}
 * and is the only entry point core code uses to resolve providers.
 */
@Injectable()
export class MarketplaceRegistryService implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceRegistryService.name);
  readonly pluginRegistry = new PluginRegistry({ minPlatformVersion: '0.2.0' });
  readonly marketplaceRegistry = new MarketplaceRegistry(this.pluginRegistry);
  readonly pluginRuntime = new MarketplacePluginRuntime(this.pluginRegistry, this.marketplaceRegistry);

  private bootstraps: Array<{
    plugin: NeekloPlugin;
    marketplaceCode: MarketplaceCode;
    providerFactory: (ctx: PluginContext) => Promise<MarketplaceProvider> | MarketplaceProvider;
  }> = [];

  onModuleInit(): void {
    this.logger.log(`Marketplace registry ready (${this.bootstraps.length} plugins queued)`);
  }

  /** Register a marketplace plugin bootstrap (called by plugin modules at init). */
  registerBootstrap(entry: {
    plugin: NeekloPlugin;
    marketplaceCode: MarketplaceCode;
    providerFactory: (ctx: PluginContext) => Promise<MarketplaceProvider> | MarketplaceProvider;
  }): void {
    this.bootstraps.push(entry);
  }

  async activateAll(ctx: PluginContext): Promise<void> {
    for (const entry of this.bootstraps) {
      await this.pluginRuntime.bootstrap(entry, ctx);
      this.logger.log(`Activated marketplace plugin: ${entry.plugin.manifest.id} → ${entry.marketplaceCode}`);
    }
  }

  getProvider(code: MarketplaceCode): MarketplaceProvider {
    return this.marketplaceRegistry.get(code);
  }

  hasProvider(code: MarketplaceCode): boolean {
    return this.marketplaceRegistry.has(code);
  }

  listProviders(): MarketplaceProvider[] {
    return this.marketplaceRegistry.list();
  }

  listPlugins() {
    return this.pluginRegistry.list();
  }

  async validatePlugin(manifest: NeekloPlugin['manifest']) {
    return this.pluginRegistry.validate(manifest);
  }

  async healthCheckAll() {
    return this.pluginRegistry.healthCheckAll();
  }
}
