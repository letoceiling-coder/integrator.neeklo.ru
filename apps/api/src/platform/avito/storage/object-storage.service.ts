import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import type { Env } from '../../config/env.schema';

export interface StoredObject {
  key: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
}

/** S3-compatible object storage (Selectel). Falls back to local pseudo-URLs when not configured. */
@Injectable()
export class ObjectStorageService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  isConfigured(): boolean {
    return Boolean(this.config.get('S3_ENDPOINT') && this.config.get('S3_ACCESS_KEY'));
  }

  buildPublicUrl(key: string): string {
    const endpoint = this.config.get('S3_ENDPOINT');
    const bucket = this.config.get('S3_BUCKET');
    if (!endpoint) return `https://cdn.neeklo.local/${key}`;
    return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
  }

  async putObject(
    tenantId: string,
    folder: string,
    filename: string,
    body: Buffer | string,
    mimeType: string,
  ): Promise<StoredObject> {
    const key = `${tenantId}/${folder}/${uuid()}-${filename}`;
    const sizeBytes = typeof body === 'string' ? Buffer.byteLength(body, 'utf8') : body.length;

    if (this.isConfigured()) {
      await this.uploadS3(key, body, mimeType);
    }

    return { key, publicUrl: this.buildPublicUrl(key), sizeBytes, mimeType };
  }

  private async uploadS3(key: string, body: Buffer | string, mimeType: string): Promise<void> {
    const endpoint = this.config.get('S3_ENDPOINT');
    const bucket = this.config.get('S3_BUCKET');
    const accessKey = this.config.get('S3_ACCESS_KEY');
    const secretKey = this.config.get('S3_SECRET_KEY');
    const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;

    const url = `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(buf.length),
        Authorization: `AWS ${accessKey}:${secretKey}`,
      },
      body: buf,
    });
    if (!res.ok) {
      throw new Error(`S3 upload failed: ${res.status} ${await res.text()}`);
    }
  }
}
