import { Body, Controller, Get, Post, Query, UsePipes } from '@nestjs/common';
import {
  Permission,
  avitoConnectSchema,
  avitoDisconnectSchema,
  avitoRefreshSchema,
  type AvitoConnectDto,
  type AvitoDisconnectDto,
  type AvitoRefreshDto,
  type CurrentUser,
} from '@neeklo/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser as CurrentUserDecorator, RequirePermissions } from '../auth/decorators';
import { RequestContextService } from '../../platform/context/request-context';
import { OAuthCenterService } from '../../platform/oauth-center/oauth-center.service';

@Controller('auth/avito')
export class AvitoOAuthController {
  constructor(
    private readonly oauth: OAuthCenterService,
    private readonly ctx: RequestContextService,
  ) {}

  private appendContext(tenantId: string) {
    const rc = this.ctx.require();
    return { tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  @Post('connect')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoConnectSchema))
  connect(@CurrentUserDecorator() user: CurrentUser, @Body() dto: AvitoConnectDto) {
    return this.oauth.connectAvito(user.tenantId, user, dto, this.appendContext(user.tenantId));
  }

  @Post('disconnect')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoDisconnectSchema))
  disconnect(@CurrentUserDecorator() user: CurrentUser, @Body() dto: AvitoDisconnectDto) {
    return this.oauth.disconnectAvito(
      user.tenantId,
      user.id,
      dto.accountId,
      dto.reason,
      this.appendContext(user.tenantId),
    );
  }

  @Post('refresh')
  @RequirePermissions(Permission.SettingsWrite)
  @UsePipes(new ZodValidationPipe(avitoRefreshSchema))
  refresh(@CurrentUserDecorator() user: CurrentUser, @Body() dto: AvitoRefreshDto) {
    return this.oauth.refreshAvito(user.tenantId, user.id, dto.accountId, this.appendContext(user.tenantId));
  }

  @Get('status')
  @RequirePermissions(Permission.SettingsWrite)
  status(@CurrentUserDecorator() user: CurrentUser, @Query('accountId') accountId: string) {
    return this.oauth.getAccountStatus(user.tenantId, accountId);
  }

  @Get('accounts')
  @RequirePermissions(Permission.SettingsWrite)
  accounts(@CurrentUserDecorator() user: CurrentUser) {
    return this.oauth.listAvitoAccounts(user.tenantId);
  }
}
