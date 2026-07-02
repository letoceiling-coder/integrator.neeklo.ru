import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  Permission,
  changePriceSchema,
  createAdSchema,
  pageQuerySchema,
  type AdReadModel,
  type ChangePriceDto,
  type CreateAdDto,
  type CurrentUser as CurrentUserDto,
  type PageResponse,
} from '@neeklo/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { AdsService } from './application/ads.service';
import { AdsQueryService } from './application/ads-query.service';

@Controller('ads')
export class AdsController {
  constructor(
    private readonly ads: AdsService,
    private readonly query: AdsQueryService,
  ) {}

  @Get()
  @RequirePermissions(Permission.AdRead)
  list(
    @CurrentUser() user: CurrentUserDto,
    @Query(new ZodValidationPipe(pageQuerySchema)) page: { cursor?: string; limit: number },
    @Query('status') status?: string,
    @Query('marketplace') marketplace?: string,
  ): Promise<PageResponse<AdReadModel>> {
    return this.query.list(user.tenantId, { ...page, status, marketplace });
  }

  @Get(':id')
  @RequirePermissions(Permission.AdRead)
  getById(@CurrentUser() user: CurrentUserDto, @Param('id') id: string): Promise<AdReadModel> {
    return this.query.getById(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(Permission.AdWrite)
  create(@Body(new ZodValidationPipe(createAdSchema)) dto: CreateAdDto): Promise<{ id: string }> {
    return this.ads.create(dto);
  }

  @Patch(':id/price')
  @RequirePermissions(Permission.AdWrite)
  async changePrice(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changePriceSchema)) dto: ChangePriceDto,
  ): Promise<{ ok: true }> {
    await this.ads.changePrice(id, dto);
    return { ok: true };
  }

  @Post(':id/archive')
  @RequirePermissions(Permission.AdWrite)
  async archive(@Param('id') id: string, @Body('reason') reason?: string): Promise<{ ok: true }> {
    await this.ads.archive(id, reason ?? null);
    return { ok: true };
  }
}
