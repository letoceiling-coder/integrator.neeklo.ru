import {
  AdStatus,
  EventType,
  type EventPayloadMap,
  type MarketplaceCode,
} from '@neeklo/contracts';
import { AggregateRoot, DomainError, type RecordedEvent } from '@neeklo/kernel';

interface Money {
  amount: number;
  currency: string;
}

interface AdState {
  marketplace: MarketplaceCode;
  status: AdStatus;
  title: string;
  categoryId: string;
  subcategoryId: string | null;
  regionId: string;
  cityId: string;
  price: Money;
  description: string;
  externalId: string | null;
  aiScore: number | null;
}

/**
 * The Ad aggregate. All mutations go through behaviour methods that enforce invariants and
 * emit past-tense facts; state is a pure fold of those facts. This is what makes "replay an
 * ad's history by seconds" and "train AI on real actions + results" possible.
 */
export class AdAggregate extends AggregateRoot {
  private state!: AdState;

  get aggregateType(): string {
    return 'ad';
  }

  get snapshot(): Readonly<AdState> {
    return this.state;
  }

  static create(
    id: string,
    input: {
      marketplace: MarketplaceCode;
      title: string;
      categoryId: string;
      subcategoryId: string | null;
      regionId: string;
      cityId: string;
      price: Money;
      description: string;
    },
  ): AdAggregate {
    const ad = new AdAggregate(id);
    ad.raise(EventType.AdCreated, {
      marketplace: input.marketplace,
      title: input.title,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      regionId: input.regionId,
      cityId: input.cityId,
      price: input.price,
      description: input.description,
      photos: [],
      aiScore: null,
    });
    return ad;
  }

  publish(externalId: string, url: string | null): void {
    if (this.state.status === AdStatus.ACTIVE) return;
    this.raise(EventType.AdPublished, {
      marketplace: this.state.marketplace,
      externalId,
      url,
      publishedAt: new Date().toISOString(),
    });
    this.raise(EventType.AdStatusChanged, {
      from: this.state.status,
      to: AdStatus.ACTIVE,
      reason: 'published',
    });
  }

  changePrice(next: Money, reason: string | null): void {
    if (next.amount <= 0) throw new DomainError('invalid_price', 'Price must be positive');
    if (next.amount === this.state.price.amount && next.currency === this.state.price.currency) {
      return;
    }
    this.raise(EventType.PriceChanged, { from: this.state.price, to: next, reason });
  }

  changeStatus(to: AdStatus, reason: string | null = null): void {
    if (this.state.status === to) return;
    this.raise(EventType.AdStatusChanged, { from: this.state.status, to, reason });
  }

  archive(reason: string | null = null): void {
    if (this.state.status === AdStatus.ARCHIVED) return;
    this.raise(EventType.AdArchived, { reason });
    this.raise(EventType.AdStatusChanged, { from: this.state.status, to: AdStatus.ARCHIVED, reason });
  }

  markSold(price: Money, dealId: string | null): void {
    this.raise(EventType.AdSold, { price, dealId, soldAt: new Date().toISOString() });
    this.raise(EventType.AdStatusChanged, { from: this.state.status, to: AdStatus.SOLD, reason: 'sold' });
  }

  recordView(count = 1, source: string | null = null): void {
    this.raise(EventType.ViewRecorded, { count, source, at: new Date().toISOString() });
  }

  protected apply(event: RecordedEvent): void {
    switch (event.type) {
      case EventType.AdCreated: {
        const p = event.payload as EventPayloadMap['ad.created'];
        this.state = {
          marketplace: p.marketplace,
          status: AdStatus.DRAFT,
          title: p.title,
          categoryId: p.categoryId,
          subcategoryId: p.subcategoryId,
          regionId: p.regionId,
          cityId: p.cityId,
          price: p.price,
          description: p.description,
          externalId: null,
          aiScore: p.aiScore,
        };
        break;
      }
      case EventType.AdPublished: {
        const p = event.payload as EventPayloadMap['ad.published'];
        this.state.externalId = p.externalId;
        break;
      }
      case EventType.AdStatusChanged: {
        const p = event.payload as EventPayloadMap['ad.status_changed'];
        this.state.status = p.to;
        break;
      }
      case EventType.PriceChanged: {
        const p = event.payload as EventPayloadMap['ad.price_changed'];
        this.state.price = p.to;
        break;
      }
      default:
        // Performance-signal events (views, favorites, …) don't change core aggregate state;
        // they are folded by projections. Nothing to do here.
        break;
    }
  }
}
