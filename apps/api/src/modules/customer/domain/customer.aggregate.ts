import {
  CommerceEventType,
  type EventPayloadMap,
  type InboxChannel,
} from '@neeklo/contracts';
import { AggregateRoot, type RecordedEvent } from '@neeklo/kernel';

interface CustomerState {
  displayName: string;
  phone: string | null;
  email: string | null;
  channel: InboxChannel;
  externalId: string | null;
  cityIds: string[];
  interests: string[];
  preferences: Record<string, unknown>;
}

/** Customer 360 aggregate. */
export class CustomerAggregate extends AggregateRoot {
  private state!: CustomerState;

  get aggregateType(): string {
    return 'customer';
  }

  static create(
    id: string,
    input: {
      displayName: string;
      phone: string | null;
      email: string | null;
      channel: InboxChannel;
      externalId: string | null;
      cityIds?: string[];
    },
  ): CustomerAggregate {
    const c = new CustomerAggregate(id);
    c.raise(CommerceEventType.CustomerCreated, {
      displayName: input.displayName,
      phone: input.phone,
      email: input.email,
      channel: input.channel,
      externalId: input.externalId,
      cityIds: input.cityIds ?? [],
    });
    return c;
  }

  update(patch: Partial<{ displayName: string; phone: string | null; email: string | null; cityIds: string[]; preferences: Record<string, unknown> }>): void {
    this.raise(CommerceEventType.CustomerUpdated, patch);
  }

  recordInterest(categoryId: string | null, adId: string | null, interest: string, score = 50): void {
    this.raise(CommerceEventType.CustomerInterestRecorded, { categoryId, adId, interest, score });
  }

  protected apply(event: RecordedEvent): void {
    switch (event.type) {
      case CommerceEventType.CustomerCreated: {
        const p = event.payload as EventPayloadMap['customer.created'];
        this.state = {
          displayName: p.displayName,
          phone: p.phone,
          email: p.email,
          channel: p.channel,
          externalId: p.externalId,
          cityIds: p.cityIds,
          interests: [],
          preferences: {},
        };
        break;
      }
      case CommerceEventType.CustomerUpdated: {
        const p = event.payload as EventPayloadMap['customer.updated'];
        this.state = {
          ...this.state,
          displayName: p.displayName ?? this.state.displayName,
          phone: p.phone !== undefined ? p.phone : this.state.phone,
          email: p.email !== undefined ? p.email : this.state.email,
          cityIds: p.cityIds ?? this.state.cityIds,
          preferences: p.preferences ? { ...this.state.preferences, ...p.preferences } : this.state.preferences,
        };
        break;
      }
      case CommerceEventType.CustomerInterestRecorded: {
        const p = event.payload as EventPayloadMap['customer.interest_recorded'];
        if (!this.state.interests.includes(p.interest)) {
          this.state.interests = [...this.state.interests, p.interest];
        }
        break;
      }
    }
  }
}
