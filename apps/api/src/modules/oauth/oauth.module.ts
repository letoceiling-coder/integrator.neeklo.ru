import { Module, forwardRef } from '@nestjs/common';
import { AdaptersModule } from '../../platform/adapters/adapters.module';
import { OAuthCenterModule } from '../../platform/oauth-center/oauth-center.module';
import { OAuthValidationService } from '../../platform/oauth-center/oauth-validation.service';
import { AvitoOAuthController } from './avito-oauth.controller';
import { OsOAuthController } from './os-oauth.controller';

@Module({
  imports: [OAuthCenterModule, forwardRef(() => AdaptersModule)],
  controllers: [AvitoOAuthController, OsOAuthController],
  providers: [OAuthValidationService],
  exports: [OAuthValidationService],
})
export class OAuthModule {}
