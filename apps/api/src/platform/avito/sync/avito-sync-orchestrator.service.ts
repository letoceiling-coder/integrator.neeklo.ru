import { Injectable } from '@nestjs/common';
import type { AppendContext } from '@neeklo/kernel';
import { RequestContextService } from '../../context/request-context';
import { AvitoAccountCenterService } from '../account/avito-account-center.service';
import { AvitoAnalyticsCenterService } from '../analytics/avito-analytics-center.service';

/** Orchestrates Avito sync with honest capability limits. */
@Injectable()
export class AvitoSyncOrchestratorService {
  constructor(
    private readonly accounts: AvitoAccountCenterService,
    private readonly analytics: AvitoAnalyticsCenterService,
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
      const pull = await this.analytics.pullAvitoStats(tenantId, accountId);
      if (!pull.ok) {
        await this.accounts.recordSyncFailed(tenantId, accountId, syncJobId, pull.error ?? 'unsupported', ctx);
        return { syncJobId, status: 'limited', note: pull.note, dataSource: pull.dataSource };
      }

      await this.accounts.recordSyncComplete(tenantId, accountId, syncJobId, 0, ctx);
      return { syncJobId, status: 'completed', result: pull.result };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'sync_failed';
      await this.accounts.recordSyncFailed(tenantId, accountId, syncJobId, error, ctx);
      return { syncJobId, status: 'failed', error };
    }
  }
}
