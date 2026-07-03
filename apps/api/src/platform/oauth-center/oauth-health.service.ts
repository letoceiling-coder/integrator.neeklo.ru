import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthCredentialStatus } from '@neeklo/contracts';
import type { Env } from '../../config/env.schema';
import { CredentialVaultService } from './vault/credential-vault.service';
import { OAuthProviderRegistry } from './providers/oauth-provider.registry';

@Injectable()
export class OAuthHealthService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly vault: CredentialVaultService,
    private readonly registry: OAuthProviderRegistry,
  ) {}

  async checkCredential(credentialId: string): Promise<{ health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'; latencyMs: number }> {
    const record = await this.vault.findById(credentialId);
    if (!record) {
      return { health: 'unknown', latencyMs: 0 };
    }

    if (record.status !== OAuthCredentialStatus.CONNECTED) {
      await this.vault.updateStatus(credentialId, { health: 'unhealthy', lastError: `Status: ${record.status}` });
      return { health: 'unhealthy', latencyMs: 0 };
    }

    const secrets = this.vault.decrypt(record);
    if (!secrets.accessToken) {
      await this.vault.updateStatus(credentialId, { health: 'unhealthy', lastError: 'No access token' });
      return { health: 'unhealthy', latencyMs: 0 };
    }

    const started = Date.now();
    try {
      const adapter = this.registry.get(record.provider);
      await adapter.fetchAccountProfile(
        secrets.accessToken,
        this.config.get('AVITO_BASE_URL', { infer: true }),
      );
      const latencyMs = Date.now() - started;
      const health = latencyMs > 3000 ? 'degraded' : 'healthy';
      await this.vault.updateStatus(credentialId, {
        health,
        lastSuccessAt: new Date(),
        lastError: null,
      });
      return { health, latencyMs };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.vault.updateStatus(credentialId, {
        health: 'unhealthy',
        lastError: message,
      });
      return { health: 'unhealthy', latencyMs: Date.now() - started };
    }
  }
}
