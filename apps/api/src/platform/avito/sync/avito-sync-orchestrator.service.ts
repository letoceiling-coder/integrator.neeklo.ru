import { Injectable } from '@nestjs/common';
import type { AppendContext } from '@neeklo/kernel';
import { RequestContextService } from '../../context/request-context';
import { AvitoAccountCenterService } from '../account/avito-account-center.service';
import { AvitoLiveSyncEngineService } from '../../avito-live/sync/avito-live-sync-engine.service';

/** Orchestrates Avito sync via Avito Live Platform (official API workers). */
@Injectable()
export class AvitoSyncOrchestratorService {
  constructor(
    private readonly accounts: AvitoAccountCenterService,
    private readonly liveEngine: AvitoLiveSyncEngineService,
    private readonly ctx: RequestContextService,
  ) {}

  private appendContext(tenantId: string): AppendContext {
    const rc = this.ctx.require();
    return { tenantId, actor: rc.actor, correlationId: rc.correlationId };
  }

  async syncAccount(tenantId: string, accountId: string) {
    const ctx = this.appendContext(tenantId);
    const { syncJobId } = await this.accounts.recordSyncStart(tenantId, accountId, ctx);

    try {
      await this.liveEngine.ensureWorkers(tenantId, accountId);
      this.liveEngine.enqueueFullSync(tenantId, accountId, ctx.correlationId);
      const processed = await this.liveEngine.processQueue(20);

      await this.accounts.recordSyncComplete(tenantId, accountId, syncJobId, processed, ctx);
      return { syncJobId, status: 'completed', workersProcessed: processed, platform: 'avito-live' };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'sync_failed';
      await this.accounts.recordSyncFailed(tenantId, accountId, syncJobId, error, ctx);
      return { syncJobId, status: 'failed', error };
    }
  }
}
