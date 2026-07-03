import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  Permission,
  sendMessageSchema,
  createDealSchema,
  changeDealStageSchema,
  createMediaJobSchema,
  searchQuerySchema,
  automationDefinitionSchema,
  InboxChannel,
} from '@neeklo/contracts';
import type { CurrentUser as CurrentUserDto } from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ConversationService, ConversationQueryService } from '../conversation/application/conversation.service';
import { CustomerService, CustomerQueryService } from '../customer/application/customer.service';
import { DealService, DealQueryService } from '../deal/application/deal.service';
import { JobEngine } from '../../platform/commerce/job/job.engine';
import { SalesAgentService } from '../../platform/commerce/sales-agent.service';
import {
  NotificationEngine,
  TaskEngine,
  CalendarEngine,
  SearchEngine,
  TimelineEngine,
  ListingStudioService,
  BudgetCenterService,
  AutomationStudioService,
} from '../../platform/commerce/commerce-services';
import { RegionalIntelligenceEngine } from '../../platform/intelligence/regional/regional-intelligence.engine';
import { RequestContextService } from '../../platform/context/request-context';
import { AvitoMessengerOutboundService } from '../../platform/avito-production/avito-messenger-outbound.service';

@Controller('commerce')
export class CommerceController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly conversationQuery: ConversationQueryService,
    private readonly customers: CustomerService,
    private readonly customerQuery: CustomerQueryService,
    private readonly deals: DealService,
    private readonly dealQuery: DealQueryService,
    private readonly jobs: JobEngine,
    private readonly agent: SalesAgentService,
    private readonly notifications: NotificationEngine,
    private readonly tasks: TaskEngine,
    private readonly calendar: CalendarEngine,
    private readonly search: SearchEngine,
    private readonly timeline: TimelineEngine,
    private readonly listingStudio: ListingStudioService,
    private readonly budget: BudgetCenterService,
    private readonly automations: AutomationStudioService,
    private readonly regional: RegionalIntelligenceEngine,
    private readonly ctx: RequestContextService,
    private readonly messengerOutbound: AvitoMessengerOutboundService,
  ) {}

  // ── Unified Inbox ─────────────────────────────────────────────
  @Get('inbox')
  @RequirePermissions(Permission.ChatRead)
  inbox(
    @CurrentUser() user: CurrentUserDto,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.conversationQuery.list(user.tenantId, { status, q });
  }

  @Get('inbox/:id')
  @RequirePermissions(Permission.ChatRead)
  getConversation(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.conversationQuery.get(id, user.tenantId);
  }

  @Get('inbox/:id/messages')
  @RequirePermissions(Permission.ChatRead)
  messages(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.conversationQuery.getMessages(id, user.tenantId);
  }

  @Post('inbox/:id/send')
  @RequirePermissions(Permission.ChatWrite)
  async sendMessage(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: { text: string; attachments?: string[] },
  ) {
    await this.conversations.sendMessage(id, { text: body.text, attachments: body.attachments ?? [] });
    const outbound = await this.messengerOutbound.sendOutbound(user.tenantId, id, body.text);
    return { ok: true, avito: outbound };
  }

  @Post('inbox/:id/pin')
  @RequirePermissions(Permission.ChatWrite)
  pin(@Param('id') id: string) {
    return this.conversations.pin(id);
  }

  @Post('inbox/:id/read')
  @RequirePermissions(Permission.ChatRead)
  markRead(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.conversations.markRead(id, user.tenantId);
  }

  @Post('inbox/start')
  @RequirePermissions(Permission.ChatWrite)
  startConversation(
    @Body() body: { channel: InboxChannel; customerId: string; adId?: string | null; subject?: string },
  ) {
    return this.conversations.start(body);
  }

  // ── Customer 360 ─────────────────────────────────────────────
  @Get('customers')
  @RequirePermissions(Permission.ChatRead)
  listCustomers(@CurrentUser() user: CurrentUserDto, @Query('q') q?: string) {
    return this.customerQuery.list(user.tenantId, q);
  }

  @Get('customers/:id')
  @RequirePermissions(Permission.ChatRead)
  customer360(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.customerQuery.get360(id, user.tenantId);
  }

  @Post('customers')
  @RequirePermissions(Permission.ChatWrite)
  createCustomer(@Body() body: { displayName: string; channel: InboxChannel; phone?: string; email?: string }) {
    return this.customers.create(body);
  }

  // ── Deal Pipeline ─────────────────────────────────────────────
  @Get('deals')
  @RequirePermissions(Permission.ChatRead)
  deals(@CurrentUser() user: CurrentUserDto) {
    return this.dealQuery.byStage(user.tenantId);
  }

  @Get('deals/:id')
  @RequirePermissions(Permission.ChatRead)
  getDeal(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.dealQuery.get(id, user.tenantId);
  }

  @Post('deals')
  @RequirePermissions(Permission.ChatWrite)
  createDeal(@Body(new ZodValidationPipe(createDealSchema)) body: unknown) {
    return this.deals.create(body as Parameters<DealService['create']>[0]);
  }

  @Put('deals/:id/stage')
  @RequirePermissions(Permission.ChatWrite)
  changeStage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeDealStageSchema)) body: unknown,
  ) {
    return this.deals.changeStage(id, body as Parameters<DealService['changeStage']>[1]);
  }

  @Post('deals/:id/apply-ai')
  @RequirePermissions(Permission.ChatWrite)
  applyAiStage(@Param('id') id: string) {
    return this.deals.applyAiSuggestion(id);
  }

  // ── Listing Studio ────────────────────────────────────────────
  @Get('listings/:adId/studio')
  @RequirePermissions(Permission.AdRead)
  listingStudio(@CurrentUser() user: CurrentUserDto, @Param('adId') adId: string) {
    return this.listingStudio.getStudio(adId, user.tenantId);
  }

  // ── Media Studio ──────────────────────────────────────────────
  @Get('media/jobs')
  @RequirePermissions(Permission.AdWrite)
  mediaJobs(@CurrentUser() user: CurrentUserDto) {
    return this.jobs.listJobs(user.tenantId);
  }

  @Post('media/jobs')
  @RequirePermissions(Permission.AdWrite)
  createMediaJob(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(createMediaJobSchema)) body: {
      kind: string;
      input?: Record<string, unknown>;
      entityType?: string | null;
      entityId?: string | null;
    },
  ) {
    const rc = this.ctx.require();
    return this.jobs.createJob(
      user.tenantId,
      body.kind,
      body.input ?? {},
      body.entityType ?? null,
      body.entityId ?? null,
      { tenantId: rc.tenantId, actor: rc.actor, correlationId: rc.correlationId },
    );
  }

  // ── AI Sales Agent ────────────────────────────────────────────
  @Post('agent/reply')
  @RequirePermissions(Permission.ChatWrite)
  agentReply(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: { conversationId: string; customerId: string; adId?: string | null; message: string; autoSend?: boolean },
  ) {
    return this.agent.reply({ tenantId: user.tenantId, ...body, adId: body.adId ?? null });
  }

  @Post('agent/summary')
  @RequirePermissions(Permission.ChatRead)
  agentSummary(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: { conversationId: string; customerId: string; messages: string[] },
  ) {
    return this.agent.generateSummary(user.tenantId, body.conversationId, body.customerId, body.messages);
  }

  // ── Budget Center ─────────────────────────────────────────────
  @Get('budget')
  @RequirePermissions(Permission.AnalyticsRead)
  budgetSummary(@CurrentUser() user: CurrentUserDto) {
    return this.budget.getSummary(user.tenantId);
  }

  // ── Regional Center ───────────────────────────────────────────
  @Get('regions')
  @RequirePermissions(Permission.AnalyticsRead)
  async regions(@CurrentUser() user: CurrentUserDto) {
    await this.regional.refresh(user.tenantId);
    return this.regional.list(user.tenantId);
  }

  // ── Automation Studio ───────────────────────────────────────
  @Get('automations')
  @RequirePermissions(Permission.AutomationWrite)
  listAutomations(@CurrentUser() user: CurrentUserDto) {
    return this.automations.list(user.tenantId);
  }

  @Post('automations')
  @RequirePermissions(Permission.AutomationWrite)
  createAutomation(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(automationDefinitionSchema)) body: { name: string; nodes: Record<string, unknown>[]; edges: Record<string, unknown>[]; enabled?: boolean },
  ) {
    return this.automations.create(user.tenantId, body.name, { nodes: body.nodes, edges: body.edges }, body.enabled);
  }

  // ── Notification Center ───────────────────────────────────────
  @Get('notifications')
  @RequirePermissions(Permission.ChatRead)
  notifications(@CurrentUser() user: CurrentUserDto, @Query('unread') unread?: string) {
    return this.notifications.list(user.tenantId, unread === 'true');
  }

  @Post('notifications/:id/read')
  @RequirePermissions(Permission.ChatRead)
  readNotification(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.notifications.markRead(id, user.tenantId);
  }

  // ── Activity Timeline ─────────────────────────────────────────
  @Get('timeline')
  @RequirePermissions(Permission.AnalyticsRead)
  timeline(
    @CurrentUser() user: CurrentUserDto,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.timeline.getTimeline(user.tenantId, entityType, entityId);
  }

  // ── Task Center ───────────────────────────────────────────────
  @Get('tasks')
  @RequirePermissions(Permission.ChatRead)
  tasks(@CurrentUser() user: CurrentUserDto) {
    return this.tasks.list(user.tenantId);
  }

  @Post('tasks/:id/complete')
  @RequirePermissions(Permission.ChatWrite)
  completeTask(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.tasks.complete(id, user.tenantId);
  }

  // ── Calendar ──────────────────────────────────────────────────
  @Get('calendar')
  @RequirePermissions(Permission.ChatRead)
  calendar(
    @CurrentUser() user: CurrentUserDto,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.calendar.list(user.tenantId, new Date(from), new Date(to));
  }

  // ── Search Everywhere ─────────────────────────────────────────
  @Get('search')
  @RequirePermissions(Permission.ChatRead)
  search(
    @CurrentUser() user: CurrentUserDto,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: { q: string; types?: string[]; limit?: number },
  ) {
    return this.search.search(user.tenantId, query.q, query.types, query.limit);
  }
}
