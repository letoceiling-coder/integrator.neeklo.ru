import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  Permission,
  bulkAdActionSchema,
  listingGeneratorInputSchema,
  regionalPublishInputSchema,
  knowledgeUploadSchema,
  budgetImportSchema,
  notificationChannelConfigSchema,
  adTemplateSchema,
  agentReplyOptionsSchema,
  assignConversationSchema,
} from '@neeklo/contracts';
import type { CurrentUser as CurrentUserDto } from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { RequestContextService } from '../../platform/context/request-context';
import { AvitoAccountCenterService } from '../../platform/avito/account/avito-account-center.service';
import { AvitoAdsManagerService } from '../../platform/avito/ads/avito-ads-manager.service';
import { ListingGeneratorPipeline } from '../../platform/avito/listing/listing-generator.pipeline';
import { RegionalPublishingService } from '../../platform/avito/regional/regional-publishing.service';
import { AvitoAnalyticsCenterService } from '../../platform/avito/analytics/avito-analytics-center.service';
import { KnowledgeBaseService } from '../../platform/avito/knowledge/knowledge-base.service';
import { MediaPipelineService } from '../../platform/avito/media/media-pipeline.service';
import { NotificationChannelService } from '../../platform/avito/notifications/notification-channel.service';
import { AvitoBudgetService } from '../../platform/avito/budget/avito-budget.service';
import { AvitoSyncOrchestratorService } from '../../platform/avito/sync/avito-sync-orchestrator.service';
import { SalesAgentService } from '../../platform/commerce/sales-agent.service';
import { RegionalIntelligenceEngine } from '../../platform/intelligence/regional/regional-intelligence.engine';
import { JobEngine } from '../../platform/commerce/job/job.engine';
import { NotificationEngine } from '../../platform/commerce/commerce-services';
import { ConversationService } from '../conversation/application/conversation.service';

@Controller('avito')
export class AvitoController {
  constructor(
    private readonly accounts: AvitoAccountCenterService,
    private readonly adsManager: AvitoAdsManagerService,
    private readonly listingGenerator: ListingGeneratorPipeline,
    private readonly regional: RegionalPublishingService,
    private readonly analytics: AvitoAnalyticsCenterService,
    private readonly knowledge: KnowledgeBaseService,
    private readonly media: MediaPipelineService,
    private readonly notifications: NotificationChannelService,
    private readonly budget: AvitoBudgetService,
    private readonly sync: AvitoSyncOrchestratorService,
    private readonly agent: SalesAgentService,
    private readonly regionalIntel: RegionalIntelligenceEngine,
    private readonly jobs: JobEngine,
    private readonly inAppNotifications: NotificationEngine,
    private readonly conversations: ConversationService,
    private readonly ctx: RequestContextService,
  ) {}

  private appendCtx(tenantId: string) {
    const rc = this.ctx.require();
    return { tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  // ── Account Center ────────────────────────────────────────────
  @Get('accounts')
  @RequirePermissions(Permission.SettingsWrite)
  accountCenter(@CurrentUser() user: CurrentUserDto) {
    return this.accounts.getAccountCenter(user.tenantId);
  }

  @Post('accounts/:id/sync')
  @RequirePermissions(Permission.AdWrite)
  syncAccount(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.sync.syncAccount(user.tenantId, id);
  }

  // ── Ads Manager ───────────────────────────────────────────────
  @Get('ads')
  @RequirePermissions(Permission.AdRead)
  searchAds(
    @CurrentUser() user: CurrentUserDto,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('groupId') groupId?: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.adsManager.searchAds(user.tenantId, { q, status, groupId, regionId });
  }

  @Post('ads/bulk')
  @RequirePermissions(Permission.AdWrite)
  bulkAds(@CurrentUser() user: CurrentUserDto, @Body(new ZodValidationPipe(bulkAdActionSchema)) body: unknown) {
    return this.adsManager.bulkAction(user.tenantId, body as Parameters<AvitoAdsManagerService['bulkAction']>[1]);
  }

  @Get('ads/templates')
  @RequirePermissions(Permission.AdRead)
  templates(@CurrentUser() user: CurrentUserDto) {
    return this.adsManager.listTemplates(user.tenantId);
  }

  @Post('ads/templates')
  @RequirePermissions(Permission.AdWrite)
  createTemplate(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(adTemplateSchema)) body: unknown,
  ) {
    return this.adsManager.createTemplate(user.tenantId, body as Parameters<AvitoAdsManagerService['createTemplate']>[1]);
  }

  @Get('ads/groups')
  @RequirePermissions(Permission.AdRead)
  groups(@CurrentUser() user: CurrentUserDto) {
    return this.adsManager.listGroups(user.tenantId);
  }

  @Post('ads/groups')
  @RequirePermissions(Permission.AdWrite)
  createGroup(@CurrentUser() user: CurrentUserDto, @Body() body: { name: string; adIds?: string[] }) {
    return this.adsManager.createGroup(user.tenantId, body.name, body.adIds);
  }

  @Get('ads/:id/studio')
  @RequirePermissions(Permission.AdRead)
  studio(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.adsManager.getStudio(id, user.tenantId);
  }

  // ── Listing Generator ───────────────────────────────────────────
  @Post('listing/generate')
  @RequirePermissions(Permission.AdWrite)
  generateListing(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(listingGeneratorInputSchema)) body: unknown,
  ) {
    return this.listingGenerator.run(user.tenantId, body as Parameters<ListingGeneratorPipeline['run']>[1], this.appendCtx(user.tenantId));
  }

  @Get('listing/pipelines')
  @RequirePermissions(Permission.AdRead)
  pipelines(@CurrentUser() user: CurrentUserDto) {
    return this.listingGenerator.list(user.tenantId);
  }

  @Get('listing/pipelines/:id')
  @RequirePermissions(Permission.AdRead)
  pipeline(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.listingGenerator.get(user.tenantId, id);
  }

  // ── Regional Publishing ─────────────────────────────────────────
  @Post('regional/publish')
  @RequirePermissions(Permission.AdWrite)
  regionalPublish(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(regionalPublishInputSchema)) body: unknown,
  ) {
    return this.regional.publishBatch(user.tenantId, body as Parameters<RegionalPublishingService['publishBatch']>[1], this.appendCtx(user.tenantId));
  }

  @Get('regional/drafts')
  @RequirePermissions(Permission.AdRead)
  regionalDrafts(@CurrentUser() user: CurrentUserDto, @Query('batchId') batchId?: string) {
    return this.regional.listDrafts(user.tenantId, batchId);
  }

  // ── Analytics Center ────────────────────────────────────────────
  @Get('analytics/summary')
  @RequirePermissions(Permission.AnalyticsRead)
  analyticsSummary(@CurrentUser() user: CurrentUserDto) {
    return this.analytics.getSummary(user.tenantId);
  }

  @Get('analytics/ads/:id')
  @RequirePermissions(Permission.AnalyticsRead)
  adAnalytics(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.analytics.getAdAnalytics(user.tenantId, id);
  }

  @Get('analytics/regional')
  @RequirePermissions(Permission.AnalyticsRead)
  regionalAnalytics(@CurrentUser() user: CurrentUserDto) {
    return this.regionalIntel.list(user.tenantId);
  }

  // ── Budget ──────────────────────────────────────────────────────
  @Get('budget')
  @RequirePermissions(Permission.AnalyticsRead)
  budget(@CurrentUser() user: CurrentUserDto) {
    return this.budget.getSummary(user.tenantId);
  }

  @Post('budget/import')
  @RequirePermissions(Permission.AdWrite)
  budgetImport(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(budgetImportSchema)) body: unknown,
  ) {
    return this.budget.importSpend(user.tenantId, body as Parameters<AvitoBudgetService['importSpend']>[1], this.appendCtx(user.tenantId));
  }

  @Get('budget/imports')
  @RequirePermissions(Permission.AnalyticsRead)
  budgetImports(@CurrentUser() user: CurrentUserDto) {
    return this.budget.listImports(user.tenantId);
  }

  // ── Knowledge Base ──────────────────────────────────────────────
  @Get('knowledge')
  @RequirePermissions(Permission.ChatRead)
  knowledgeList(@CurrentUser() user: CurrentUserDto) {
    return this.knowledge.list(user.tenantId);
  }

  @Post('knowledge')
  @RequirePermissions(Permission.SettingsWrite)
  knowledgeUpload(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(knowledgeUploadSchema)) body: unknown,
  ) {
    return this.knowledge.upload(user.tenantId, body as Parameters<KnowledgeBaseService['upload']>[1], this.appendCtx(user.tenantId));
  }

  @Get('knowledge/search')
  @RequirePermissions(Permission.ChatRead)
  knowledgeSearch(@CurrentUser() user: CurrentUserDto, @Query('q') q: string) {
    return this.knowledge.retrieve(user.tenantId, q);
  }

  // ── Media Pipeline ──────────────────────────────────────────────
  @Get('media/assets')
  @RequirePermissions(Permission.AdRead)
  mediaAssets(@CurrentUser() user: CurrentUserDto, @Query('kind') kind?: string) {
    return this.media.listAssets(user.tenantId, kind);
  }

  @Get('media/jobs')
  @RequirePermissions(Permission.AdRead)
  mediaJobs(@CurrentUser() user: CurrentUserDto) {
    return this.jobs.listJobs(user.tenantId);
  }

  // ── Notifications ───────────────────────────────────────────────
  @Get('notifications')
  @RequirePermissions(Permission.ChatRead)
  notifications(@CurrentUser() user: CurrentUserDto, @Query('unread') unread?: string) {
    return this.inAppNotifications.list(user.tenantId, unread === 'true');
  }

  @Get('notifications/channels')
  @RequirePermissions(Permission.SettingsWrite)
  notificationChannels(@CurrentUser() user: CurrentUserDto) {
    return this.notifications.getConfig(user.tenantId);
  }

  @Put('notifications/channels')
  @RequirePermissions(Permission.SettingsWrite)
  saveNotificationChannels(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(notificationChannelConfigSchema)) body: unknown,
  ) {
    return this.notifications.saveConfig(user.tenantId, body as Parameters<NotificationChannelService['saveConfig']>[1]);
  }

  // ── AI Sales Agent ──────────────────────────────────────────────
  @Post('agent/reply')
  @RequirePermissions(Permission.ChatWrite)
  agentReply(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(agentReplyOptionsSchema)) body: unknown,
  ) {
    const opts = body as Parameters<typeof this.agent.replyWithOptions>[0];
    return this.agent.replyWithOptions({ ...opts, tenantId: user.tenantId });
  }

  @Post('inbox/:id/assign')
  @RequirePermissions(Permission.ChatWrite)
  assignInbox(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignConversationSchema)) body: { assigneeId: string },
  ) {
    return this.conversations.assign(id, body.assigneeId, null);
  }

  @Get('dashboard')
  @RequirePermissions(Permission.AnalyticsRead)
  async dashboard(@CurrentUser() user: CurrentUserDto) {
    const [accounts, analytics, budgetSummary, knowledgeDocs] = await Promise.all([
      this.accounts.getAccountCenter(user.tenantId),
      this.analytics.getSummary(user.tenantId),
      this.budget.getSummary(user.tenantId),
      this.knowledge.list(user.tenantId),
    ]);
    return { accounts: accounts.length, analytics, budget: budgetSummary, knowledgeDocs: knowledgeDocs.length };
  }
}
