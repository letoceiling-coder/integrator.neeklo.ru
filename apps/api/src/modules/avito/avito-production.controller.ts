import { Body, Controller, Get, Param, Post, Put, Query, Sse, UsePipes } from '@nestjs/common';
import {
  Permission,
  avitoRuntimeModeUpdateSchema,
  avitoWizardStepSchema,
  type AvitoRuntimeModeUpdateDto,
  type AvitoWizardStepDto,
  type CurrentUser as CurrentUserDto,
} from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AvitoProductionCenterService } from '../../platform/avito-production/avito-production-center.service';
import type { AvitoFeedExportDto } from '@neeklo/contracts';

@Controller('avito/production')
export class AvitoProductionController {
  constructor(private readonly production: AvitoProductionCenterService) {}

  @Get('readiness')
  @RequirePermissions(Permission.AnalyticsRead)
  readiness(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.production.readiness.getReadiness(user.tenantId, accountId);
  }

  @Get('monitor')
  @RequirePermissions(Permission.AnalyticsRead)
  monitor(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.production.monitor.getMonitor(user.tenantId, accountId);
  }

  @Get('mode')
  @RequirePermissions(Permission.SettingsWrite)
  mode(@CurrentUser() user: CurrentUserDto) {
    return this.production.sandbox.getMode(user.tenantId);
  }

  @Put('mode')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoRuntimeModeUpdateSchema))
  setMode(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoRuntimeModeUpdateDto) {
    return this.production.sandbox.setMode(user.tenantId, body.mode);
  }

  @Get('permissions')
  @RequirePermissions(Permission.AnalyticsRead)
  permissions(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.production.permissions.get(user.tenantId, accountId);
  }

  @Get('wizard')
  @RequirePermissions(Permission.SettingsWrite)
  wizard(@CurrentUser() user: CurrentUserDto) {
    return this.production.wizard.getWizard(user.tenantId);
  }

  @Post('wizard/step')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoWizardStepSchema))
  wizardStep(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoWizardStepDto) {
    return this.production.wizard.advanceStep(user.tenantId, body.step);
  }

  @Get('backup/export')
  @RequirePermissions(Permission.SettingsWrite)
  backupExport(@CurrentUser() user: CurrentUserDto) {
    return this.production.backup.exportAll(user.tenantId);
  }

  @Post('backup/import')
  @RequirePermissions(Permission.SettingsWrite)
  backupImport(@CurrentUser() user: CurrentUserDto, @Body() body: Record<string, unknown>) {
    return this.production.backup.importConfig(user.tenantId, body);
  }

  @Get('feed/validate')
  @RequirePermissions(Permission.AnalyticsRead)
  validateFeed(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.production.feed.validateFeed(user.tenantId, accountId);
  }

  @Get('feed/diff')
  @RequirePermissions(Permission.AnalyticsRead)
  feedDiff(
    @CurrentUser() user: CurrentUserDto,
    @Query('accountId') accountId: string,
    @Query('v1') v1: string,
    @Query('v2') v2: string,
  ) {
    return this.production.feed.diffVersions(user.tenantId, accountId, Number(v1), Number(v2));
  }

  @Post('feed/rollback')
  @RequirePermissions(Permission.SettingsWrite)
  feedRollback(
    @CurrentUser() user: CurrentUserDto,
    @Query('accountId') accountId: string,
    @Query('version') version: string,
  ) {
    return this.production.feed.rollback(user.tenantId, accountId, Number(version));
  }

  @Post('feed/export')
  @RequirePermissions(Permission.AdWrite)
  feedExport(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoFeedExportDto) {
    return this.production.feed.exportFeed(user.tenantId, body);
  }

  @Post('test/:component')
  @RequirePermissions(Permission.SettingsWrite)
  liveTest(
    @CurrentUser() user: CurrentUserDto,
    @Param('component') component: 'oauth' | 'webhook' | 'feed' | 'messenger' | 'ai',
    @Query('accountId') accountId: string,
  ) {
    return this.production.liveTest.runComponent(user.tenantId, accountId, component);
  }

  @Post('messenger/send')
  @RequirePermissions(Permission.ChatWrite)
  messengerSend(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: { conversationId: string; text: string },
  ) {
    return this.production.messenger.sendOutbound(user.tenantId, body.conversationId, body.text);
  }

  @Sse('events')
  @RequirePermissions(Permission.AnalyticsRead)
  events(@CurrentUser() user: CurrentUserDto) {
    return this.production.realtime.stream(user.tenantId);
  }
}
