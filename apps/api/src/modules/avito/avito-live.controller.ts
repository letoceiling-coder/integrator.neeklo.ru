import { Body, Controller, Get, Post, Put, Query, UsePipes } from '@nestjs/common';
import {
  Permission,
  avitoSyncScheduleUpdateSchema,
  type AvitoSyncScheduleUpdateDto,
  type CurrentUser as CurrentUserDto,
} from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AvitoLivePlatformService } from '../../platform/avito-live/avito-live-platform.service';

/** Avito Live Platform API — dashboard, explorer, sync, webhooks, health. */
@Controller('avito/live')
export class AvitoLiveController {
  constructor(private readonly live: AvitoLivePlatformService) {}

  @Get('dashboard')
  @RequirePermissions(Permission.AdRead)
  dashboard(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.live.getDashboard(user.tenantId, accountId);
  }

  @Post('sync')
  @RequirePermissions(Permission.AdWrite)
  sync(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.live.triggerFullSync(user.tenantId, accountId);
  }

  @Put('schedule')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoSyncScheduleUpdateSchema))
  schedule(@CurrentUser() user: CurrentUserDto, @Body() body: AvitoSyncScheduleUpdateDto) {
    return this.live.updateSchedule(user.tenantId, body.accountId, body.worker, body.interval, body.enabled);
  }

  @Get('overview')
  @RequirePermissions(Permission.AdRead)
  overview(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.live.getAccountOverview(user.tenantId, accountId);
  }

  @Get('explorer')
  @RequirePermissions(Permission.AdRead)
  explorer(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.live.getExplorer(user.tenantId, accountId);
  }

  @Get('usage')
  @RequirePermissions(Permission.AdRead)
  usage(@CurrentUser() user: CurrentUserDto) {
    return this.live.getApiUsage(user.tenantId);
  }

  @Get('webhooks')
  @RequirePermissions(Permission.SettingsWrite)
  webhooks(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.live.getWebhookCenter(user.tenantId, accountId);
  }

  @Post('webhooks/test')
  @RequirePermissions(Permission.SettingsWrite)
  testWebhook(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.live.handleWebhook(user.tenantId, accountId, 'test.ping', { test: true, at: new Date().toISOString() });
  }

  @Get('timeline')
  @RequirePermissions(Permission.AdRead)
  timeline(
    @CurrentUser() user: CurrentUserDto,
    @Query('accountId') accountId: string,
    @Query('limit') limit?: string,
  ) {
    return this.live.getTimeline(user.tenantId, accountId, limit ? Number(limit) : 50);
  }

  @Get('inspector')
  @RequirePermissions(Permission.AdRead)
  inspector(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.live.getInspector(user.tenantId, accountId);
  }

  @Get('health')
  @RequirePermissions(Permission.AdRead)
  health(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.live.getHealth(user.tenantId, accountId);
  }
}
