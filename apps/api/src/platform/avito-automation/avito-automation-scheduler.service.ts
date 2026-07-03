import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiWatchersService } from './ai-watchers.service';
import { AutomationRulesService } from './automation-rules.service';
import { AiOpportunitiesService } from './ai-opportunities.service';
import { PriceIntelligenceService } from './price-intelligence.service';
import { ContentIntelligenceService } from './content-intelligence.service';
import { AiReportsService } from './ai-reports.service';
import { ExecutiveAiService } from './executive-ai.service';
import { NotificationPoliciesService } from './notification-policies.service';

/** Hourly watchers/rules; daily opportunities; morning reports at ~07:00 UTC. */
@Injectable()
export class AvitoAutomationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvitoAutomationSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastDailyKey = '';
  private lastMorningKey = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly watchers: AiWatchersService,
    private readonly rules: AutomationRulesService,
    private readonly opportunities: AiOpportunitiesService,
    private readonly price: PriceIntelligenceService,
    private readonly content: ContentIntelligenceService,
    private readonly reports: AiReportsService,
    private readonly executive: ExecutiveAiService,
    private readonly notificationPolicies: NotificationPoliciesService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick().catch((e) => this.logger.error(e)), 300_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const tenants = await this.prisma.organizationReadModel.findMany({ take: 50 });
    const now = new Date();
    const dailyKey = now.toISOString().slice(0, 10);
    const morningKey = `${dailyKey}-07`;

    for (const org of tenants) {
      const tenantId = org.tenantId;
      await this.watchers.evaluateAll(tenantId);
      await this.rules.evaluateAll(tenantId);

      if (this.lastDailyKey !== dailyKey) {
        await this.opportunities.scanDaily(tenantId);
        await this.price.generateForTenant(tenantId);
        await this.content.analyzeTopAds(tenantId, 3);
        await this.executive.generate(tenantId);
      }

      if (this.lastMorningKey !== morningKey && now.getUTCHours() === 7) {
        const report = await this.reports.generateMorningReport(tenantId);
        await this.notificationPolicies.dispatchFiltered(
          tenantId,
          {
            category: 'ai_report',
            title: 'Утренний AI-отчёт',
            body: report.summary,
            priority: 'normal',
          },
          'ai',
        );
      }
    }

    if (this.lastDailyKey !== dailyKey) this.lastDailyKey = dailyKey;
    if (now.getUTCHours() === 7) this.lastMorningKey = morningKey;
  }
}
