import { Body, Controller, Get, Param, Post, Put, Query, UsePipes } from '@nestjs/common';
import {
  Permission,
  avitoAiWatcherCreateSchema,
  avitoAutomationRuleSchema,
  avitoNotificationPolicySchema,
  type AvitoAiWatcherCreateDto,
  type AvitoAutomationRuleUpsertDto,
  type AvitoNotificationPolicyUpsertDto,
  type CurrentUser as CurrentUserDto,
} from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AvitoAutomationCenterService } from '../../platform/avito-automation/avito-automation-center.service';

@Controller('avito/automation')
export class AvitoAutomationController {
  constructor(private readonly automation: AvitoAutomationCenterService) {}

  @Get('watchers')
  @RequirePermissions(Permission.AnalyticsRead)
  watchers(@CurrentUser() user: CurrentUserDto) {
    return this.automation.watchers.list(user.tenantId);
  }

  @Post('watchers')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoAiWatcherCreateSchema))
  createWatcher(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoAiWatcherCreateDto) {
    return this.automation.watchers.create(user.tenantId, body);
  }

  @Post('watchers/evaluate')
  @RequirePermissions(Permission.AnalyticsRead)
  evaluateWatchers(@CurrentUser() user: CurrentUserDto) {
    return this.automation.watchers.evaluateAll(user.tenantId);
  }

  @Get('rules')
  @RequirePermissions(Permission.AnalyticsRead)
  rules(@CurrentUser() user: CurrentUserDto) {
    return this.automation.rules.list(user.tenantId);
  }

  @Put('rules')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoAutomationRuleSchema))
  upsertRule(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoAutomationRuleUpsertDto) {
    return this.automation.rules.upsert(user.tenantId, body);
  }

  @Post('rules/evaluate')
  @RequirePermissions(Permission.SettingsWrite)
  evaluateRules(@CurrentUser() user: CurrentUserDto) {
    return this.automation.rules.evaluateAll(user.tenantId);
  }

  @Get('observatory')
  @RequirePermissions(Permission.AnalyticsRead)
  observatory(@CurrentUser() user: CurrentUserDto, @Query('includeDismissed') includeDismissed?: string) {
    return this.automation.observatory.getFeed(user.tenantId, includeDismissed === 'true');
  }

  @Post('observatory/:id/dismiss')
  @RequirePermissions(Permission.AnalyticsRead)
  dismissObservatory(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.automation.observatory.dismiss(user.tenantId, id);
  }

  @Get('opportunities')
  @RequirePermissions(Permission.AnalyticsRead)
  opportunities(@CurrentUser() user: CurrentUserDto) {
    return this.automation.opportunities.list(user.tenantId);
  }

  @Post('opportunities/scan')
  @RequirePermissions(Permission.AnalyticsRead)
  scanOpportunities(@CurrentUser() user: CurrentUserDto) {
    return this.automation.opportunities.scanDaily(user.tenantId);
  }

  @Get('price')
  @RequirePermissions(Permission.AnalyticsRead)
  priceRecommendations(@CurrentUser() user: CurrentUserDto, @Query('status') status?: string) {
    return this.automation.price.list(user.tenantId, status ?? 'pending');
  }

  @Post('price/generate')
  @RequirePermissions(Permission.AnalyticsRead)
  generatePrice(@CurrentUser() user: CurrentUserDto) {
    return this.automation.price.generateForTenant(user.tenantId);
  }

  @Post('price/:id/dismiss')
  @RequirePermissions(Permission.AnalyticsRead)
  dismissPrice(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.automation.price.dismiss(user.tenantId, id);
  }

  @Get('content')
  @RequirePermissions(Permission.AnalyticsRead)
  contentRecommendations(@CurrentUser() user: CurrentUserDto, @Query('adId') adId?: string) {
    return this.automation.content.list(user.tenantId, adId);
  }

  @Post('content/analyze/:adId')
  @RequirePermissions(Permission.AnalyticsRead)
  analyzeContent(@CurrentUser() user: CurrentUserDto, @Param('adId') adId: string) {
    return this.automation.content.analyzeAd(user.tenantId, adId);
  }

  @Get('notification-policies')
  @RequirePermissions(Permission.AnalyticsRead)
  notificationPolicies(@CurrentUser() user: CurrentUserDto) {
    return this.automation.notificationPolicies.list(user.tenantId);
  }

  @Put('notification-policies')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoNotificationPolicySchema))
  upsertNotificationPolicy(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoNotificationPolicyUpsertDto) {
    return this.automation.notificationPolicies.upsert(user.tenantId, body);
  }

  @Get('reports')
  @RequirePermissions(Permission.AnalyticsRead)
  reports(@CurrentUser() user: CurrentUserDto) {
    return this.automation.reports.list(user.tenantId);
  }

  @Get('reports/latest')
  @RequirePermissions(Permission.AnalyticsRead)
  latestReport(@CurrentUser() user: CurrentUserDto) {
    return this.automation.reports.getLatest(user.tenantId);
  }

  @Post('reports/generate')
  @RequirePermissions(Permission.AnalyticsRead)
  generateReport(@CurrentUser() user: CurrentUserDto) {
    return this.automation.reports.generateMorningReport(user.tenantId);
  }

  @Get('executive')
  @RequirePermissions(Permission.AnalyticsRead)
  executive(@CurrentUser() user: CurrentUserDto) {
    return this.automation.executive.getSnapshot(user.tenantId);
  }

  @Post('executive/refresh')
  @RequirePermissions(Permission.AnalyticsRead)
  refreshExecutive(@CurrentUser() user: CurrentUserDto) {
    return this.automation.executive.generate(user.tenantId);
  }

  @Post('run-all')
  @RequirePermissions(Permission.SettingsWrite)
  async runAll(@CurrentUser() user: CurrentUserDto) {
    const tenantId = user.tenantId;
    const [watchers, rules, opps, price, content, report, executive] = await Promise.all([
      this.automation.watchers.evaluateAll(tenantId),
      this.automation.rules.evaluateAll(tenantId),
      this.automation.opportunities.scanDaily(tenantId),
      this.automation.price.generateForTenant(tenantId),
      this.automation.content.analyzeTopAds(tenantId, 5),
      this.automation.reports.generateMorningReport(tenantId),
      this.automation.executive.generate(tenantId),
    ]);
    return { watchers, rules, opps, price, content, report, executive };
  }
}
