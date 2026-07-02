import { Module } from '@nestjs/common';
import { AdapterRegistry } from './adapter.registry';
import { AvitoClient } from './avito/avito.client';

@Module({
  providers: [AvitoClient, AdapterRegistry],
  exports: [AdapterRegistry, AvitoClient],
})
export class AdaptersModule {}
