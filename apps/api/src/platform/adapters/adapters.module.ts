import { Module, forwardRef } from '@nestjs/common';
import { OAuthCenterModule } from '../oauth-center/oauth-center.module';
import { AdapterRegistry } from './adapter.registry';
import { AvitoClient } from './avito/avito.client';

@Module({
  imports: [forwardRef(() => OAuthCenterModule)],
  providers: [AvitoClient, AdapterRegistry],
  exports: [AdapterRegistry, AvitoClient],
})
export class AdaptersModule {}
