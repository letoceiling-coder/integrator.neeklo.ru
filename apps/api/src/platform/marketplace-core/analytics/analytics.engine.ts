import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { EVENT_BUS, type EventBus, type StoredEvent } from '@neeklo/kernel';
import { isEventType } from '@neeklo/contracts';
import { MetricsEngine } from '../metrics/metrics.engine';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { RecommendationEngine } from '../recommendation/recommendation.engine';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Analytics Engine — standalone service consuming the event stream.
 *
 * Pipeline: Event Stream → Projection data → Metrics Engine → Analytics → Forecast → Recommendations
 *
 * Subscribes to the bus independently of UI; feeds MetricsEngine and RecommendationEngine.
 */
@Injectable()
export class AnalyticsEngine implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnalyticsEngine.name);

  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly metrics: MetricsEngine,
    private readonly knowledgeGraph: KnowledgeGraphService,
    private readonly recommendations: RecommendationEngine,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.subscribe((event) => this.process(event), { group: 'analytics-engine' });
    this.logger.log('Analytics engine subscribed to event stream');
  }

  private async process(event: StoredEvent): Promise<void> {
    if (!isEventType(event.type)) return;

    try {
      await this.knowledgeGraph.ingestEvent(event);

      if (event.type.startsWith('ad.')) {
        await this.processAdEvent(event);
      }
      if (event.type.startsWith('account.') || event.type.startsWith('marketplace.')) {
        await this.processMarketplaceEvent(event);
      }
    } catch (err) {
      this.logger.error(`Analytics processing failed for ${event.type}`, err instanceof Error ? err.stack : err);
    }
  }

  private async processAdEvent(event: StoredEvent): Promise<void> {
    const ad = await this.prisma.adReadModel.findUnique({ where: { id: event.aggregateId } });
    if (!ad) return;

    const computed = this.metrics.computeForAd(ad);
    await this.metrics.persist(event.tenantId, 'ad', ad.id, computed);

    if (['ad.view_recorded', 'ad.contact_recorded', 'ad.price_changed'].includes(event.type)) {
      await this.recommendations.analyzeAd(event.tenantId, ad.id, computed);
    }
  }

  private async processMarketplaceEvent(event: StoredEvent): Promise<void> {
    this.logger.debug(`Marketplace analytics event: ${event.type} [${event.eventId}]`);
  }

  /** Aggregate analytics for tenant dashboard. */
  async getTenantSummary(tenantId: string): Promise<{
    totalAds: number;
    activeAds: number;
    totalViews: number;
    totalContacts: number;
    avgRoi: number;
  }> {
    const ads = await this.prisma.adReadModel.findMany({ where: { tenantId } });
    const activeAds = ads.filter((a) => a.status === 'active').length;
    const totalViews = ads.reduce((s, a) => s + a.views, 0);
    const totalContacts = ads.reduce((s, a) => s + a.contacts, 0);
    const totalSpend = ads.reduce((s, a) => s + a.spendAmount, 0);
    const totalRevenue = ads.reduce((s, a) => s + a.revenueAmount, 0);
    const avgRoi = totalSpend > 0 ? (totalRevenue - totalSpend) / totalSpend : 0;
    return { totalAds: ads.length, activeAds, totalViews, totalContacts, avgRoi };
  }
}
