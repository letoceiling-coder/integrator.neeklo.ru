import { Body, Controller, Get, Param, Post, Put, Query, UsePipes } from '@nestjs/common';
import {
  Permission,
  avitoAdsFilterSchema,
  avitoAdStudioUpdateSchema,
  avitoBulkOperationSchema,
  avitoFeedExportSchema,
  avitoMediaProJobSchema,
  type AvitoAdsFilterDto,
  type AvitoAdStudioUpdateDto,
  type AvitoBulkOperationDto,
  type AvitoFeedExportDto,
  type AvitoMediaProJobDto,
  type CurrentUser as CurrentUserDto,
} from '@neeklo/contracts';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { RequestContextService } from '../../platform/context/request-context';
import { AvitoOperationsCenterService } from '../../platform/avito-operations/avito-operations-center.service';
import { AvitoOperationsStudioService } from '../../platform/avito-operations/avito-operations-studio.service';
import { AvitoOperationsBulkService } from '../../platform/avito-operations/avito-operations-bulk.service';
import { AvitoOperationsFeedService } from '../../platform/avito-operations/avito-operations-feed.service';
import { MediaPipelineService } from '../../platform/avito/media/media-pipeline.service';
import { JobEngine } from '../../platform/commerce/job/job.engine';
import { MediaJobKind } from '@neeklo/contracts';

@Controller('avito/operations')
export class AvitoOperationsController {
  constructor(
    private readonly ops: AvitoOperationsCenterService,
    private readonly studio: AvitoOperationsStudioService,
    private readonly bulk: AvitoOperationsBulkService,
    private readonly feed: AvitoOperationsFeedService,
    private readonly media: MediaPipelineService,
    private readonly jobs: JobEngine,
    private readonly ctx: RequestContextService,
  ) {}

  private appendCtx(tenantId: string) {
    const rc = this.ctx.require();
    return { tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  @Get('ads')
  @RequirePermissions(Permission.AdRead)
  ads(@CurrentUser() user: CurrentUserDto, @Query() query: Record<string, string | undefined>) {
    const parsed = avitoAdsFilterSchema.parse({
      ...query,
      priceMin: query.priceMin ? Number(query.priceMin) : undefined,
      priceMax: query.priceMax ? Number(query.priceMax) : undefined,
      aiScoreMin: query.aiScoreMin ? Number(query.aiScoreMin) : undefined,
      contactsMin: query.contactsMin ? Number(query.contactsMin) : undefined,
      ctrMin: query.ctrMin ? Number(query.ctrMin) : undefined,
      limit: query.limit ? Number(query.limit) : 100,
    });
    return this.ops.searchAds(user.tenantId, parsed);
  }

  @Get('ads/:id/studio')
  @RequirePermissions(Permission.AdRead)
  adStudio(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.studio.getStudio(user.tenantId, id);
  }

  @Put('ads/:id/studio')
  @RequirePermissions(Permission.AdWrite)
  updateStudio(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(avitoAdStudioUpdateSchema)) body: AvitoAdStudioUpdateDto,
  ) {
    return this.studio.updateStudio(user.tenantId, id, body, this.appendCtx(user.tenantId));
  }

  @Get('ads/:id/quality')
  @RequirePermissions(Permission.AdRead)
  quality(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.studio.qualityReport(user.tenantId, id);
  }

  @Post('ads/:id/ai-rewrite')
  @RequirePermissions(Permission.AdWrite)
  aiRewrite(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.studio.aiRewrite(user.tenantId, id, this.appendCtx(user.tenantId));
  }

  @Post('bulk')
  @RequirePermissions(Permission.AdWrite)
  bulkOps(@CurrentUser() user: CurrentUserDto, @Body(new ZodValidationPipe(avitoBulkOperationSchema)) body: AvitoBulkOperationDto) {
    return this.bulk.execute(user.tenantId, body, this.appendCtx(user.tenantId));
  }

  @Get('regional/drafts')
  @RequirePermissions(Permission.AdRead)
  regionalDrafts(@CurrentUser() user: CurrentUserDto, @Query('batchId') batchId?: string) {
    return this.ops.listRegionalDrafts(user.tenantId, batchId);
  }

  @Get('feed')
  @RequirePermissions(Permission.AdRead)
  feedStudio(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.ops.getFeedStudio(user.tenantId, accountId);
  }

  @Post('feed/export')
  @RequirePermissions(Permission.AdWrite)
  feedExport(@CurrentUser() user: CurrentUserDto, @Body(new ZodValidationPipe(avitoFeedExportSchema)) body: AvitoFeedExportDto) {
    return this.feed.exportFeed(user.tenantId, body);
  }

  @Get('promotion')
  @RequirePermissions(Permission.AdRead)
  promotion(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId: string) {
    return this.ops.getPromotionCenter(user.tenantId, accountId);
  }

  @Get('timeline')
  @RequirePermissions(Permission.AdRead)
  timeline(
    @CurrentUser() user: CurrentUserDto,
    @Query('adId') adId?: string,
    @Query('accountId') accountId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ops.getTimeline(user.tenantId, { adId, accountId, limit: limit ? Number(limit) : 100 });
  }

  @Get('health')
  @RequirePermissions(Permission.AdRead)
  health(@CurrentUser() user: CurrentUserDto, @Query('accountId') accountId?: string) {
    return this.ops.getHealth(user.tenantId, accountId);
  }

  @Post('media/jobs')
  @RequirePermissions(Permission.AdWrite)
  mediaJob(@CurrentUser() user: CurrentUserDto, @Body(new ZodValidationPipe(avitoMediaProJobSchema)) body: AvitoMediaProJobDto) {
    const kindMap: Record<string, string> = {
      remove_background: MediaJobKind.REMOVE_BACKGROUND,
      enhance: MediaJobKind.ENHANCE,
      banner: MediaJobKind.BANNER,
      infographic: MediaJobKind.INFOGRAPHIC,
      watermark: MediaJobKind.WATERMARK,
      resize: MediaJobKind.RESIZE,
      compress: MediaJobKind.ENHANCE,
      generate_image: MediaJobKind.GENERATE_IMAGE,
    };
    const kind = kindMap[body.kind] ?? MediaJobKind.GENERATE_IMAGE;
    return this.jobs.createJob(
      user.tenantId,
      kind,
      body.input ?? {},
      body.entityType ?? null,
      body.entityId ?? null,
      this.appendCtx(user.tenantId),
    );
  }

  @Get('media/assets')
  @RequirePermissions(Permission.AdRead)
  mediaAssets(@CurrentUser() user: CurrentUserDto, @Query('kind') kind?: string) {
    return this.media.listAssets(user.tenantId, kind);
  }
}
