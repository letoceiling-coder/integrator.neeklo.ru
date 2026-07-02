import { Module } from '@nestjs/common';
import { AdaptersModule } from '../adapters/adapters.module';
import { AvitoMarketplacePlugin } from '../../plugins/avito/avito-marketplace.plugin';
import { PluginBootstrapService } from './plugin-bootstrap.service';

@Module({
  imports: [AdaptersModule],
  providers: [AvitoMarketplacePlugin, PluginBootstrapService],
  exports: [PluginBootstrapService, AvitoMarketplacePlugin],
})
export class PluginRuntimeModule {}
