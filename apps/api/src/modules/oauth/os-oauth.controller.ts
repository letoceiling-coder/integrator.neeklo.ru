import { Body, Controller, Get, Post, Query, Res, UsePipes } from '@nestjs/common';
import type { Response } from 'express';
import {
  Permission,
  oauthTestSchema,
  type CurrentUser,
  type OAuthTestRequest,
} from '@neeklo/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser as CurrentUserDecorator, Public, RequirePermissions } from '../auth/decorators';
import { OAuthCenterService } from '../../platform/oauth-center/oauth-center.service';
import { OAuthValidationService } from '../../platform/oauth-center/oauth-validation.service';
import { OAuthConnectionReportService } from '../../platform/oauth-center/oauth-connection-report.service';

/** Platform OAuth endpoints — unified callback at /api/auth/os/callback. */
@Controller('auth/os')
export class OsOAuthController {
  constructor(
    private readonly oauth: OAuthCenterService,
    private readonly validation: OAuthValidationService,
    private readonly connectionReport: OAuthConnectionReportService,
  ) {}

  @Public()
  @Get('callback')
  async callback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.oauth.handleAvitoCallback({
      state,
      code,
      error,
      error_description: errorDescription,
    });
    res.redirect(result.redirectUrl);
  }

  @Get('config')
  @RequirePermissions(Permission.SettingsWrite)
  config() {
    return this.validation.getConfig();
  }

  @Get('debug')
  @RequirePermissions(Permission.SettingsWrite)
  debug(@CurrentUserDecorator() user: CurrentUser, @Query('accountId') accountId: string) {
    return this.validation.getDebugInfo(user.tenantId, accountId);
  }

  @Post('validate')
  @RequirePermissions(Permission.SettingsWrite)
  validate(@CurrentUserDecorator() user: CurrentUser, @Query('accountId') accountId?: string) {
    return this.validation.runSuite(user.tenantId, accountId);
  }

  @Post('test')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(oauthTestSchema))
  test(@CurrentUserDecorator() user: CurrentUser, @Body() body: OAuthTestRequest) {
    return this.validation.runTest(user.tenantId, body.accountId, body.action);
  }

  @Get('console')
  @RequirePermissions(Permission.SettingsWrite)
  console(@Query('limit') limit?: string) {
    return this.validation.listConsole(limit ? Number(limit) : 50);
  }

  @Get('health')
  @RequirePermissions(Permission.SettingsWrite)
  health(@CurrentUserDecorator() user: CurrentUser, @Query('accountId') accountId: string) {
    return this.validation.getHealthDashboard(user.tenantId, accountId);
  }

  @Get('checklist')
  @RequirePermissions(Permission.SettingsWrite)
  checklist(@CurrentUserDecorator() user: CurrentUser, @Query('accountId') accountId: string) {
    return this.validation.getProductionChecklist(user.tenantId, accountId);
  }

  @Get('connection-report')
  @RequirePermissions(Permission.SettingsWrite)
  connectionReport(@CurrentUserDecorator() user: CurrentUser, @Query('accountId') accountId: string) {
    return this.connectionReport.buildReport(user.tenantId, accountId);
  }

  @Get('integration-dashboard')
  @RequirePermissions(Permission.SettingsWrite)
  integrationDashboard(@CurrentUserDecorator() user: CurrentUser) {
    return this.connectionReport.getIntegrationDashboard(user.tenantId);
  }
}
