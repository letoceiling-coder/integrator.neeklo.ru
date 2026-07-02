import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { MarketplaceCode } from '@neeklo/contracts';
import { type PluginContext } from '@neeklo/plugin-runtime';
import { MarketplaceRegistryService } from '../marketplace-core/registry/marketplace-registry.service';
import { AvitoMarketplacePlugin } from '../../plugins/avito/avito-marketplace.plugin';
import { RequestContextService } from '../context/request-context';

/**
 * Bootstraps all marketplace plugins at application start.
 * Adding a new marketplace = register one bootstrap entry here (no core changes).
 */
@Injectable()
export class PluginBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginBootstrapService.name);

  constructor(
    private readonly registry: MarketplaceRegistryService,
    private readonly avitoPlugin: AvitoMarketplacePlugin,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.registry.registerBootstrap({
      plugin: this.avitoPlugin,
      marketplaceCode: MarketplaceCode.AVITO,
      providerFactory: () => this.avitoPlugin.createProvider(),
    });

    const ctx: PluginContext = {
      organizationId: null,
      correlationId: RequestContextService.newCorrelationId(),
      config: {},
      logger: {
        debug: (m, meta) => this.logger.debug(meta ? `${m} ${JSON.stringify(meta)}` : m),
        info: (m, meta) => this.logger.log(meta ? `${m} ${JSON.stringify(meta)}` : m),
        warn: (m, meta) => this.logger.warn(meta ? `${m} ${JSON.stringify(meta)}` : m),
        error: (m, meta) => this.logger.error(meta ? `${m} ${JSON.stringify(meta)}` : m),
      },
      emit: (event, payload) => this.logger.debug(`Plugin event: ${event}`, payload),
    };

    await this.registry.activateAll(ctx);
    this.logger.log(`Activated ${this.registry.listProviders().length} marketplace provider(s)`);
  }
}
