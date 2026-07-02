import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '@neeklo/kernel';
import type { Env } from '../../../config/env.schema';

interface TokenState {
  accessToken: string;
  expiresAt: number; // epoch ms
}

/**
 * Thin, real HTTP client for the Avito API. Handles OAuth2 client-credentials with token
 * caching/refresh and typed JSON requests. Credentials are read from config today; the
 * signature is tenant-scoped so per-tenant credential storage can drop in without callers changing.
 */
@Injectable()
export class AvitoClient {
  private readonly logger = new Logger(AvitoClient.name);
  private token: TokenState | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get baseUrl(): string {
    return this.config.get('AVITO_BASE_URL', { infer: true });
  }

  async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.accessToken;
    }
    const clientId = this.config.get('AVITO_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('AVITO_CLIENT_SECRET', { infer: true });
    if (!clientId || !clientSecret) {
      throw new DomainError('avito_not_configured', 'Avito client credentials are not configured');
    }

    const res = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      throw new DomainError('avito_auth_failed', `Avito auth failed (${res.status})`, {
        status: res.status,
        body: await res.text().catch(() => ''),
      });
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      accessToken: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return this.token.accessToken;
  }

  /** Authorized JSON request against the Avito API. */
  async request<T>(
    method: string,
    path: string,
    options: { query?: Record<string, string | number>; body?: unknown } = {},
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(options.query ?? {})) {
      url.searchParams.set(k, String(v));
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      throw new DomainError('avito_request_failed', `Avito ${method} ${path} → ${res.status}`, {
        status: res.status,
        body: await res.text().catch(() => ''),
      });
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
