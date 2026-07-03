import { Injectable } from '@nestjs/common';
import type { AvitoProductionCheckItemDto, AvitoProductionReadinessDto } from '@neeklo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { OAuthValidationService } from '../oauth-center/oauth-validation.service';
import { AvitoLivePlatformService } from '../avito-live/avito-live-platform.service';
import { ProductionSandboxService } from './production-sandbox.service';

@Injectable()
export class ProductionReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: OAuthValidationService,
    private readonly live: AvitoLivePlatformService,
    private readonly sandbox: ProductionSandboxService,
  ) {}

  async getReadiness(tenantId: string, accountId: string): Promise<AvitoProductionReadinessDto> {
    const mode = await this.sandbox.getMode(tenantId);
    const items: AvitoProductionCheckItemDto[] = [];

    const checklist = await this.oauth.getProductionChecklist(tenantId, accountId);
    const mapStatus = (s: string): AvitoProductionCheckItemDto['status'] =>
      s === 'pass' ? 'pass' : s === 'warn' ? 'warn' : 'fail';

    for (const [key, label] of [
      ['oauth', 'OAuth'],
      ['profile', 'Profile'],
      ['ads', 'Ads'],
      ['messenger', 'Messenger'],
      ['stats', 'Analytics'],
      ['webhook', 'Webhook'],
      ['autoload', 'Feed / Autoload'],
      ['health', 'Health'],
    ] as const) {
      items.push({
        id: key,
        label,
        status: mapStatus(checklist[key]),
        message: `${label}: ${checklist[key]}`,
      });
    }

    const webhookCfg = await this.prisma.avitoWebhookConfigReadModel.findFirst({ where: { tenantId, accountId } });
    items.push({
      id: 'webhook_config',
      label: 'Webhook Config',
      status: webhookCfg?.webhookUrl ? 'pass' : 'warn',
      message: webhookCfg?.webhookUrl ? 'Webhook URL configured' : 'Register webhook URL in Avito cabinet',
    });

    const syncWorkers = await this.prisma.avitoLiveSyncWorkerReadModel.findMany({ where: { tenantId, accountId }, take: 20 });
    const syncOk = syncWorkers.some((w) => w.lastStatus === 'completed');
    items.push({
      id: 'sync',
      label: 'Live Sync',
      status: syncOk ? 'pass' : syncWorkers.length ? 'warn' : 'fail',
      message: syncOk ? 'Sync workers completed' : 'Run Live Platform sync',
    });

    const leads = await this.prisma.avitoLeadReadModel.count({ where: { tenantId } });
    items.push({ id: 'crm', label: 'CRM / Leads', status: leads > 0 ? 'pass' : 'warn', message: `${leads} leads` });

    const rules = await this.prisma.avitoAutomationRuleReadModel.count({ where: { tenantId, enabled: true } });
    items.push({ id: 'automation', label: 'Automation', status: rules > 0 ? 'pass' : 'warn', message: `${rules} active rules` });

    const watchers = await this.prisma.avitoAiWatcherReadModel.count({ where: { tenantId, enabled: true } });
    items.push({ id: 'watchers', label: 'AI Watchers', status: watchers > 0 ? 'pass' : 'warn', message: `${watchers} watchers` });

    const storageOk = Boolean(process.env.S3_BUCKET || process.env.S3_ENDPOINT);
    items.push({ id: 'storage', label: 'Storage', status: storageOk ? 'pass' : 'warn', message: storageOk ? 'S3 configured' : 'Local/stub storage' });

    try {
      const health = await this.live.getHealth(tenantId, accountId);
      const liveOk = health.sync.status === 'pass' && health.avitoApi.status === 'pass';
      items.push({
        id: 'live_health',
        label: 'Live Health',
        status: liveOk ? 'pass' : 'warn',
        message: `Sync: ${health.sync.status}, API: ${health.avitoApi.status}`,
      });
    } catch {
      items.push({ id: 'live_health', label: 'Live Health', status: 'warn', message: 'Could not load live health' });
    }

    const pass = items.filter((i) => i.status === 'pass').length;
    const score = Math.round((pass / items.length) * 100);
    const ready = score >= 70 && items.find((i) => i.id === 'oauth')?.status === 'pass';

    return { ready, score, mode, items, checkedAt: new Date().toISOString() };
  }
}
