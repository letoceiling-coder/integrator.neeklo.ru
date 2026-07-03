import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceCode } from '@neeklo/contracts';
import { DomainError } from '@neeklo/kernel';
import type { Env } from '../../../config/env.schema';
import { TokenManagerService } from '../../oauth-center/token-manager.service';
import { OAuthApiConsoleService } from '../../oauth-center/oauth-api-console.service';

/**
 * Per-account Avito HTTP client. Resolves OAuth tokens from Credential Vault — never from .env.
 */
@Injectable()
export class AvitoClient {
  private readonly logger = new Logger(AvitoClient.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly tokenManager: TokenManagerService,
    @Optional() private readonly apiConsole?: OAuthApiConsoleService,
  ) {}

  private get baseUrl(): string {
    return this.config.get('AVITO_BASE_URL', { infer: true });
  }

  async getAccessToken(tenantId: string, accountId: string): Promise<string> {
    return this.tokenManager.resolveAccessToken(tenantId, MarketplaceCode.AVITO, accountId);
  }

  /** Authorized JSON request against the Avito API for a specific marketplace account. */
  async request<T>(
    tenantId: string,
    accountId: string,
    method: string,
    path: string,
    options: { query?: Record<string, string | number>; body?: unknown } = {},
  ): Promise<T> {
    const token = await this.getAccessToken(tenantId, accountId);
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(options.query ?? {})) {
      url.searchParams.set(k, String(v));
    }

    const started = Date.now();
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const latencyMs = Date.now() - started;
    const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
    const responseText = await res.text().catch(() => '');

    this.apiConsole?.log({
      method,
      url: url.toString(),
      status: res.status,
      latencyMs,
      rateLimitRemaining: rateLimitRemaining ? Number(rateLimitRemaining) : null,
      responsePreview: responseText.slice(0, 500),
    });

    if (!res.ok) {
      throw new DomainError('avito_request_failed', `Avito ${method} ${path} → ${res.status}`, {
        status: res.status,
        body: responseText,
      });
    }
    if (res.status === 204) return undefined as T;
    return (responseText ? JSON.parse(responseText) : undefined) as T;
  }
}
