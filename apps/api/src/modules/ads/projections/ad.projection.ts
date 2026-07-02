import { Injectable } from '@nestjs/common';
import {
  AdStatus,
  EventType,
  type EventPayloadMap,
} from '@neeklo/contracts';
import type { StoredEvent } from '@neeklo/kernel';
import type { Projection, ProjectionTx } from '../../../platform/projections/projection';
import { MetricsEngine } from '../../../platform/marketplace-core/metrics/metrics.engine';

const HANDLED = new Set<EventType>([
  EventType.AdCreated,
  EventType.AdPublished,
  EventType.AdStatusChanged,
  EventType.PriceChanged,
  EventType.ViewRecorded,
  EventType.FavoriteAdded,
  EventType.ContactRecorded,
  EventType.MessageReceived,
  EventType.AdSold,
  EventType.BudgetSpent,
  EventType.PromotionActivated,
]);

/** Base counters we roll up; derived metrics (CTR, ROI, …) are recomputed from these. */
interface Derived {
  views: number;
  contacts: number;
  messages: number;
  spendAmount: number;
  revenueAmount: number;
}

@Injectable()
export class AdProjection implements Projection {
  readonly name = 'ad_read_model';
  readonly handles = HANDLED;

  constructor(private readonly metricsEngine: MetricsEngine) {}

  async project(event: StoredEvent, tx: ProjectionTx): Promise<void> {
    const at = new Date(event.occurredAt);

    switch (event.type) {
      case EventType.AdCreated: {
        const p = event.payload as EventPayloadMap['ad.created'];
        await tx.adReadModel.upsert({
          where: { id: event.aggregateId },
          create: {
            id: event.aggregateId,
            tenantId: event.tenantId,
            marketplace: p.marketplace,
            externalId: null,
            status: AdStatus.DRAFT,
            title: p.title,
            categoryId: p.categoryId,
            subcategoryId: p.subcategoryId,
            regionId: p.regionId,
            cityId: p.cityId,
            priceAmount: p.price.amount,
            priceCurrency: p.price.currency,
            aiScore: p.aiScore,
            createdAt: at,
            updatedAt: at,
          },
          update: {},
        });
        break;
      }
      case EventType.AdPublished: {
        const p = event.payload as EventPayloadMap['ad.published'];
        await tx.adReadModel.update({
          where: { id: event.aggregateId },
          data: { externalId: p.externalId, updatedAt: at },
        });
        break;
      }
      case EventType.AdStatusChanged: {
        const p = event.payload as EventPayloadMap['ad.status_changed'];
        await tx.adReadModel.update({
          where: { id: event.aggregateId },
          data: { status: p.to, updatedAt: at },
        });
        break;
      }
      case EventType.PriceChanged: {
        const p = event.payload as EventPayloadMap['ad.price_changed'];
        await tx.adReadModel.update({
          where: { id: event.aggregateId },
          data: { priceAmount: p.to.amount, priceCurrency: p.to.currency, updatedAt: at },
        });
        break;
      }
      case EventType.ViewRecorded: {
        const p = event.payload as EventPayloadMap['ad.view_recorded'];
        await this.bump(tx, event.aggregateId, at, { views: p.count });
        break;
      }
      case EventType.FavoriteAdded: {
        await tx.adReadModel.update({
          where: { id: event.aggregateId },
          data: { favorites: { increment: 1 }, updatedAt: at },
        });
        break;
      }
      case EventType.ContactRecorded: {
        await this.bump(tx, event.aggregateId, at, { contacts: 1 });
        break;
      }
      case EventType.MessageReceived: {
        const p = event.payload as EventPayloadMap['conversation.message_received'];
        if (p.adId) await this.bump(tx, p.adId, at, { messages: 1 });
        break;
      }
      case EventType.AdSold: {
        const p = event.payload as EventPayloadMap['ad.sold'];
        await this.bump(tx, event.aggregateId, at, { revenueAmount: p.price.amount });
        break;
      }
      case EventType.BudgetSpent: {
        const p = event.payload as EventPayloadMap['budget.spent'];
        if (p.adId) await this.bump(tx, p.adId, at, { spendAmount: p.amount.amount });
        break;
      }
      case EventType.PromotionActivated: {
        const p = event.payload as EventPayloadMap['ad.promotion_activated'];
        await this.bump(tx, event.aggregateId, at, { spendAmount: p.cost.amount });
        break;
      }
      default:
        break;
    }
  }

  /** Increment base counters, then recompute derived metrics atomically. */
  private async bump(
    tx: ProjectionTx,
    adId: string,
    at: Date,
    delta: Partial<Derived>,
  ): Promise<void> {
    const current = await tx.adReadModel.findUnique({ where: { id: adId } });
    if (!current) return; // event for an ad we haven't projected yet; ordering guarantees rarity

    const views = current.views + (delta.views ?? 0);
    const contacts = current.contacts + (delta.contacts ?? 0);
    const messages = current.messages + (delta.messages ?? 0);
    const spendAmount = current.spendAmount + (delta.spendAmount ?? 0);
    const revenueAmount = current.revenueAmount + (delta.revenueAmount ?? 0);

    const computed = this.metricsEngine.computeForAd({
      views,
      contacts,
      spendAmount,
      revenueAmount,
      favorites: current.favorites,
      messages,
      aiScore: current.aiScore,
    });

    await tx.adReadModel.update({
      where: { id: adId },
      data: {
        views,
        contacts,
        messages,
        spendAmount,
        revenueAmount,
        ctr: computed.ctr,
        conversion: computed.conversion,
        roi: computed.roi,
        costPerContact: computed.cpa,
        costPerView: views > 0 ? spendAmount / views : 0,
        updatedAt: at,
      },
    });
  }
}
