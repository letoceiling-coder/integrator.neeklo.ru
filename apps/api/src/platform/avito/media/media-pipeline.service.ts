import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { AvitoEventType, MediaJobKind } from '@neeklo/contracts';
import type { AppendContext } from '@neeklo/kernel';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { AvitoEventPublisher } from '../events/avito-event.publisher';
import { OpenRouterClient } from '../../ai/openrouter.client';

/** AI Media Pipeline — image jobs via provider stub + Selectel storage. */
@Injectable()
export class MediaPipelineService {
  private readonly logger = new Logger(MediaPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly publisher: AvitoEventPublisher,
    private readonly openrouter: OpenRouterClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async processJob(
    tenantId: string,
    jobId: string,
    kind: string,
    input: Record<string, unknown>,
    entityType: string | null,
    entityId: string | null,
    ctx: AppendContext,
  ): Promise<{ outputUrl: string; assetId: string }> {
    const prompt = String(input.prompt ?? input.description ?? kind);
    let mimeType = 'image/png';
    let body: Buffer | string;

    if (kind === MediaJobKind.PDF || kind === MediaJobKind.PRESENTATION) {
      const text = await this.generateText(prompt);
      mimeType = 'application/pdf';
      body = `%PDF-1.4 stub\n${text}`;
    } else if (kind === MediaJobKind.WATERMARK) {
      const label = String(input.watermark ?? input.text ?? 'NEEKLO');
      body = this.buildSvg(prompt, 800, 600, label);
    } else if (kind === MediaJobKind.RESIZE) {
      const w = Number(input.width ?? 640);
      const h = Number(input.height ?? 480);
      body = this.buildSvg(prompt, w, h);
    } else if (kind === MediaJobKind.BANNER || kind === MediaJobKind.INFOGRAPHIC) {
      const text = await this.generateText(`Create ${kind} layout description for: ${prompt}`);
      body = this.buildSvg(text.slice(0, 120), 1200, kind === MediaJobKind.BANNER ? 400 : 800, kind);
    } else if (kind === MediaJobKind.REMOVE_BACKGROUND || kind === MediaJobKind.ENHANCE) {
      const provider = this.config.get('AI_IMAGE_PROVIDER') || 'stub';
      if (provider === 'stub') {
        body = this.buildSvg(`${kind}: ${prompt}`, 800, 600, 'AI provider required for production quality');
      } else {
        body = await this.generateImage(prompt, provider);
      }
    } else {
      const imageProvider = this.config.get('AI_IMAGE_PROVIDER') || 'stub';
      body = await this.generateImage(prompt, imageProvider);
    }

    const stored = await this.storage.putObject(tenantId, 'media', `${jobId}.${mimeType.includes('pdf') ? 'pdf' : 'png'}`, body, mimeType);
    const assetId = uuid();

    await this.prisma.mediaAssetReadModel.create({
      data: {
        id: assetId,
        tenantId,
        kind,
        storageKey: stored.key,
        publicUrl: stored.publicUrl,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        entityType,
        entityId,
        jobId,
        createdAt: new Date(),
      },
    });

    await this.publisher.publish(tenantId, `media:${jobId}`, AvitoEventType.MediaAssetStored, {
      assetId,
      kind,
      storageKey: stored.key,
      publicUrl: stored.publicUrl,
      entityType,
      entityId,
    }, ctx);

    return { outputUrl: stored.publicUrl, assetId };
  }

  listAssets(tenantId: string, kind?: string) {
    return this.prisma.mediaAssetReadModel.findMany({
      where: { tenantId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async generateText(prompt: string): Promise<string> {
    const res = await this.openrouter.chat('listing', [
      { role: 'system', content: 'Generate presentation outline or PDF text content.' },
      { role: 'user', content: prompt },
    ]);
    return res.text;
  }

  private buildSvg(text: string, width: number, height: number, badge?: string): Buffer {
    const safe = text.replace(/[<>&"]/g, ' ');
    const badgeText = badge ? `<text x="20" y="${height - 20}" fill="#888" font-size="14">${badge.replace(/[<>&"]/g, ' ')}</text>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect fill="#1a1a2e" width="100%" height="100%"/><text x="40" y="80" fill="#eee" font-size="24">${safe.slice(0, 80)}</text>${badgeText}</svg>`;
    return Buffer.from(svg, 'utf8');
  }

  private async generateImage(prompt: string, provider: string): Promise<Buffer> {
    this.logger.log(`Image generation via ${provider}: ${prompt.slice(0, 80)}`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#1a1a2e" width="100%" height="100%"/><text x="40" y="80" fill="#eee" font-size="24">${prompt.slice(0, 60)}</text></svg>`;
    return Buffer.from(svg, 'utf8');
  }
}
