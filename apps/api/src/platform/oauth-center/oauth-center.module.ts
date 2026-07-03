import { Global, Module, forwardRef } from '@nestjs/common';
import { AccountModule } from '../../modules/account/account.module';
import { MarketplaceCoreModule } from '../marketplace-core/marketplace-core.module';
import { AvitoPlatformModule } from '../avito/avito-platform.module';
import { AdaptersModule } from '../adapters/adapters.module';
import { CredentialCipherService } from './encryption/credential-cipher.service';
import { AvitoOAuthProvider } from './providers/avito-oauth.provider';
import { OAuthProviderRegistry } from './providers/oauth-provider.registry';
import { CredentialVaultService } from './vault/credential-vault.service';
import { OAuthEventPublisher } from './events/oauth-event.publisher';
import { OAuthCenterService } from './oauth-center.service';
import { TokenManagerService } from './token-manager.service';
import { OAuthHealthService } from './oauth-health.service';
import { OAuthApiConsoleService } from './oauth-api-console.service';
import { OAuthValidationService } from './oauth-validation.service';
import { OAuthProvisioningService } from './oauth-provisioning.service';
import { OAuthConnectionReportService } from './oauth-connection-report.service';

@Global()
@Module({
  imports: [AccountModule, MarketplaceCoreModule, forwardRef(() => AvitoPlatformModule), forwardRef(() => AdaptersModule)],
  providers: [
    CredentialCipherService,
    AvitoOAuthProvider,
    OAuthProviderRegistry,
    CredentialVaultService,
    OAuthEventPublisher,
    TokenManagerService,
    OAuthHealthService,
    OAuthApiConsoleService,
    OAuthValidationService,
    OAuthProvisioningService,
    OAuthConnectionReportService,
    OAuthCenterService,
  ],
  exports: [
    CredentialCipherService,
    CredentialVaultService,
    OAuthProviderRegistry,
    OAuthEventPublisher,
    TokenManagerService,
    OAuthHealthService,
    OAuthApiConsoleService,
    OAuthValidationService,
    OAuthProvisioningService,
    OAuthConnectionReportService,
    OAuthCenterService,
  ],
})
export class OAuthCenterModule {}

