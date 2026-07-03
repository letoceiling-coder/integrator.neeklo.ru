import { Injectable } from '@nestjs/common';
import type { AvitoLiveTestResultDto } from '@neeklo/contracts';
import { OAuthValidationService } from '../oauth-center/oauth-validation.service';
import { ProductionSandboxService } from './production-sandbox.service';
import { AvitoMessengerOutboundService } from './avito-messenger-outbound.service';
import { ProductionFeedService } from './production-feed.service';

@Injectable()
export class ProductionLiveTestService {
  constructor(
    private readonly oauth: OAuthValidationService,
    private readonly sandbox: ProductionSandboxService,
    private readonly messenger: AvitoMessengerOutboundService,
    private readonly feed: ProductionFeedService,
  ) {}

  async runComponent(
    tenantId: string,
    accountId: string,
    component: 'oauth' | 'webhook' | 'feed' | 'messenger' | 'ai',
  ): Promise<AvitoLiveTestResultDto> {
    const mode = await this.sandbox.getMode(tenantId);
    const started = Date.now();

    try {
      switch (component) {
        case 'oauth': {
          const r = await this.oauth.runTest(tenantId, accountId, 'profile');
          return { component, ok: r.ok, mode, latencyMs: Date.now() - started, message: r.ok ? 'OAuth OK' : r.error ?? 'fail' };
        }
        case 'webhook': {
          const r = await this.oauth.runTest(tenantId, accountId, 'api');
          return { component, ok: r.ok, mode, latencyMs: Date.now() - started, message: r.ok ? 'API reachable for webhook path' : r.error ?? 'fail' };
        }
        case 'feed': {
          const v = await this.feed.validateFeed(tenantId, accountId);
          return { component, ok: v.valid, mode, latencyMs: Date.now() - started, message: v.valid ? `${v.adCount} ads valid` : v.errors[0] ?? 'invalid' };
        }
        case 'messenger': {
          if (mode === 'sandbox') {
            return { component, ok: true, mode, latencyMs: Date.now() - started, message: 'Sandbox: messenger send disabled by design' };
          }
          const r = await this.oauth.runTest(tenantId, accountId, 'api');
          return { component, ok: r.ok, mode, latencyMs: Date.now() - started, message: r.ok ? 'Messenger API scope OK' : r.error ?? 'fail' };
        }
        case 'ai': {
          return { component, ok: true, mode, latencyMs: Date.now() - started, message: 'AI Platform reads read models — no Avito API call' };
        }
        default:
          return { component, ok: false, mode, latencyMs: 0, message: 'Unknown component' };
      }
    } catch (e) {
      return {
        component,
        ok: false,
        mode,
        latencyMs: Date.now() - started,
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
