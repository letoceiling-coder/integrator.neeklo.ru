import { Module } from '@nestjs/common';

import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigModule } from './config/config.module';

import { ContextInterceptor } from './common/context.interceptor';

import { DomainExceptionFilter } from './common/domain-exception.filter';

import { ContextModule } from './platform/context/context.module';

import { PlatformModule } from './platform/platform.module';

import { MarketplaceCoreModule } from './platform/marketplace-core/marketplace-core.module';

import { IntelligenceModule } from './platform/intelligence/intelligence.module';

import { CommerceModule } from './platform/commerce/commerce.module';

import { AiPlatformModule } from './platform/ai-platform/ai-platform.module';

import { AvitoPlatformModule } from './platform/avito/avito-platform.module';

import { PluginRuntimeModule } from './platform/plugin-runtime/plugin-runtime.module';

import { AiModule } from './platform/ai/ai.module';

import { WorkflowModule } from './platform/workflow/workflow.module';

import { ProjectionsModule } from './platform/projections/projections.module';

import { AdaptersModule } from './platform/adapters/adapters.module';

import { AuthModule } from './modules/auth/auth.module';

import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

import { PermissionsGuard } from './modules/auth/guards/permissions.guard';

import { AdsModule } from './modules/ads/ads.module';

import { MarketplaceModule } from './modules/marketplace/marketplace.module';

import { AccountModule } from './modules/account/account.module';

import { OrganizationModule } from './modules/organization/organization.module';

import { IntelligenceApiModule } from './modules/intelligence/intelligence.module';

import { CommerceApiModule } from './modules/commerce/commerce.module';

import { AvitoApiModule } from './modules/avito/avito.module';

import { AiApiModule } from './modules/ai/ai.module';

import { HealthModule } from './modules/health/health.module';



@Module({

  imports: [

    ConfigModule,

    ContextModule,

    PlatformModule,

    ProjectionsModule,

    IntelligenceModule,

    CommerceModule,

    AiPlatformModule,

    AvitoPlatformModule,

    MarketplaceCoreModule,

    PluginRuntimeModule,

    AiModule,

    WorkflowModule,

    AdaptersModule,

    AuthModule,

    AdsModule,

    MarketplaceModule,

    AccountModule,

    OrganizationModule,

    IntelligenceApiModule,

    CommerceApiModule,

    AiApiModule,

    AvitoApiModule,

    HealthModule,

  ],

  providers: [

    { provide: APP_FILTER, useClass: DomainExceptionFilter },

    { provide: APP_GUARD, useClass: JwtAuthGuard },

    { provide: APP_GUARD, useClass: PermissionsGuard },

    { provide: APP_INTERCEPTOR, useClass: ContextInterceptor },

  ],

})

export class AppModule {}

