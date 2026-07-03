import { Body, Controller, Get, Param, Post, Put, Query, UsePipes } from '@nestjs/common';
import {
  Permission,
  avitoCreateTaskSchema,
  avitoDocumentCreateSchema,
  avitoPipelineMoveSchema,
  avitoSalesAgentConfigSchema,
  avitoSmartReplyRequestSchema,
  type AvitoCreateTaskDto,
  type AvitoDocumentCreateDto,
  type AvitoPipelineMoveDto,
  type AvitoSalesAgentConfigDto,
  type AvitoSmartReplyRequestDto,
  type CurrentUser as CurrentUserDto,
} from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { RequestContextService } from '../../platform/context/request-context';
import { AvitoSalesCenterService } from '../../platform/avito-sales/avito-sales-center.service';

@Controller('avito/sales')
export class AvitoSalesController {
  constructor(
    private readonly sales: AvitoSalesCenterService,
    private readonly ctx: RequestContextService,
  ) {}

  private appendCtx(tenantId: string) {
    const rc = this.ctx.require();
    return { tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  @Get('leads')
  @RequirePermissions(Permission.ChatRead)
  leads(@CurrentUser() user: CurrentUserDto, @Query('stage') stage?: string) {
    return this.sales.leads.list(user.tenantId, stage);
  }

  @Get('leads/:id')
  @RequirePermissions(Permission.ChatRead)
  lead(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.sales.leads.get(user.tenantId, id);
  }

  @Get('pipeline')
  @RequirePermissions(Permission.ChatRead)
  pipeline(@CurrentUser() user: CurrentUserDto) {
    return this.sales.pipeline.getKanban(user.tenantId);
  }

  @Put('pipeline/move')
  @RequirePermissions(Permission.ChatWrite)
  @UsePipes(new ZodValidationPipe(avitoPipelineMoveSchema))
  movePipeline(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoPipelineMoveDto) {
    return this.sales.pipeline.moveLead(user.tenantId, body, this.appendCtx(user.tenantId));
  }

  @Get('customers/:id/360')
  @RequirePermissions(Permission.ChatRead)
  customer360(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.sales.customer360.get360(user.tenantId, id);
  }

  @Get('inbox')
  @RequirePermissions(Permission.ChatRead)
  inbox(@CurrentUser() user: CurrentUserDto, @Query('conversationId') conversationId?: string) {
    return this.sales.inbox.getInbox(user.tenantId, conversationId);
  }

  @Post('smart-replies')
  @RequirePermissions(Permission.ChatWrite)
  @UsePipes(new ZodValidationPipe(avitoSmartReplyRequestSchema))
  smartReplies(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoSmartReplyRequestDto) {
    return this.sales.smartReplies.generate(user.tenantId, body);
  }

  @Get('agent/config')
  @RequirePermissions(Permission.SettingsWrite)
  agentConfig(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.sales.agentConfig.get(user.tenantId, accountId);
  }

  @Put('agent/config')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoSalesAgentConfigSchema))
  updateAgentConfig(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoSalesAgentConfigDto) {
    return this.sales.agentConfig.upsert(user.tenantId, body);
  }

  @Post('agent/reply')
  @RequirePermissions(Permission.ChatWrite)
  agentReply(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: { conversationId: string; customerId: string; adId?: string | null; message: string; autoSend?: boolean; accountId?: string },
  ) {
    return this.sales.agent.reply({ tenantId: user.tenantId, ...body, adId: body.adId ?? null });
  }

  @Get('tasks')
  @RequirePermissions(Permission.ChatRead)
  tasks(@CurrentUser() user: CurrentUserDto) {
    return this.sales.tasks.list(user.tenantId);
  }

  @Post('tasks')
  @RequirePermissions(Permission.ChatWrite)
  @UsePipes(new ZodValidationPipe(avitoCreateTaskSchema))
  createTask(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoCreateTaskDto) {
    return this.sales.tasks.create(user.tenantId, {
      title: body.title,
      description: body.description,
      priority: body.priority,
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    });
  }

  @Post('tasks/:id/complete')
  @RequirePermissions(Permission.ChatWrite)
  completeTask(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.sales.tasks.complete(id, user.tenantId);
  }

  @Get('calendar')
  @RequirePermissions(Permission.ChatRead)
  calendar(
    @CurrentUser() user: CurrentUserDto,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.sales.calendar.list(user.tenantId, new Date(from), new Date(to));
  }

  @Post('documents')
  @RequirePermissions(Permission.ChatWrite)
  @UsePipes(new ZodValidationPipe(avitoDocumentCreateSchema))
  createDocument(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoDocumentCreateDto) {
    return this.sales.documents.create(user.tenantId, body);
  }

  @Get('documents')
  @RequirePermissions(Permission.ChatRead)
  listDocuments(@CurrentUser() user: CurrentUserDto) {
    return this.sales.documents.list(user.tenantId);
  }

  @Get('deals/:id/analysis')
  @RequirePermissions(Permission.ChatRead)
  dealAnalysis(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.sales.dealAnalyzer.analyze(user.tenantId, id);
  }

  @Get('notifications')
  @RequirePermissions(Permission.ChatRead)
  notifications(@CurrentUser() user: CurrentUserDto, @Query('unread') unread?: string) {
    return this.sales.notifications.list(user.tenantId, unread === 'true');
  }

  @Get('dashboard')
  @RequirePermissions(Permission.AnalyticsRead)
  dashboard(@CurrentUser() user: CurrentUserDto) {
    return this.sales.dashboard.getExecutive(user.tenantId);
  }

  @Post('sync/messenger')
  @RequirePermissions(Permission.ChatWrite)
  syncMessenger(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.sales.bridge.syncFromMessengerSnapshot(user.tenantId, accountId);
  }
}
