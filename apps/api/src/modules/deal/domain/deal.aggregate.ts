import {
  CommerceEventType,
  DealStage,
  EventType,
  type EventPayloadMap,
} from '@neeklo/contracts';
import { AggregateRoot, DomainError, type RecordedEvent } from '@neeklo/kernel';

interface Money {
  amount: number;
  currency: string;
}

interface DealState {
  customerId: string;
  adId: string | null;
  stage: DealStage;
  expectedAmount: Money;
  actualAmount: Money | null;
  assigneeId: string | null;
  aiSuggestedStage: DealStage | null;
  aiConfidence: number | null;
  closed: boolean;
}

const STAGE_ORDER: DealStage[] = [
  DealStage.LEAD,
  DealStage.INTERESTED,
  DealStage.NEGOTIATION,
  DealStage.OFFER,
  DealStage.RESERVED,
  DealStage.PAID,
  DealStage.COMPLETED,
];

/** Deal pipeline aggregate. */
export class DealAggregate extends AggregateRoot {
  private state!: DealState;

  get aggregateType(): string {
    return 'deal';
  }

  get snapshot(): Readonly<DealState> {
    return this.state;
  }

  static create(
    id: string,
    input: { customerId: string; adId: string | null; expectedAmount: Money },
  ): DealAggregate {
    const d = new DealAggregate(id);
    d.raise(EventType.DealCreated, input);
    return d;
  }

  changeStage(to: DealStage, reason: string | null, suggestedByAi = false): void {
    if (this.state.closed) throw new DomainError('deal_closed', 'Deal is closed');
    if (this.state.stage === to) return;
    this.raise(CommerceEventType.DealStageChanged, { from: this.state.stage, to, reason, suggestedByAi });
  }

  suggestStage(stage: DealStage, confidence: number, reason: string): void {
    this.raise(CommerceEventType.DealAiStageSuggested, { suggestedStage: stage, confidence, reason });
  }

  makeOffer(amount: Money, validUntil: string | null): void {
    this.raise(CommerceEventType.DealOfferMade, { amount, validUntil });
    if (this.state.stage !== DealStage.OFFER) {
      this.changeStage(DealStage.OFFER, 'offer_made');
    }
  }

  markPaid(amount: Money): void {
    this.raise(CommerceEventType.DealPaid, { amount, paidAt: new Date().toISOString() });
    this.changeStage(DealStage.PAID, 'payment_received');
  }

  complete(amount: Money): void {
    this.raise(CommerceEventType.DealCompleted, { amount, completedAt: new Date().toISOString() });
    this.raise(EventType.DealWon, { amount, closedAt: new Date().toISOString() });
  }

  cancel(reason: string): void {
    this.raise(CommerceEventType.DealCancelled, { reason, cancelledAt: new Date().toISOString() });
    this.raise(EventType.DealLost, { reason, closedAt: new Date().toISOString() });
  }

  protected apply(event: RecordedEvent): void {
    switch (event.type) {
      case EventType.DealCreated: {
        const p = event.payload as EventPayloadMap['deal.created'];
        this.state = {
          customerId: p.customerId,
          adId: p.adId,
          stage: DealStage.LEAD,
          expectedAmount: p.expectedAmount,
          actualAmount: null,
          assigneeId: null,
          aiSuggestedStage: null,
          aiConfidence: null,
          closed: false,
        };
        break;
      }
      case CommerceEventType.DealStageChanged: {
        const p = event.payload as EventPayloadMap['deal.stage_changed'];
        this.state.stage = p.to;
        break;
      }
      case CommerceEventType.DealAiStageSuggested: {
        const p = event.payload as EventPayloadMap['deal.ai_stage_suggested'];
        this.state.aiSuggestedStage = p.suggestedStage;
        this.state.aiConfidence = p.confidence;
        break;
      }
      case CommerceEventType.DealPaid: {
        const p = event.payload as EventPayloadMap['deal.paid'];
        this.state.actualAmount = p.amount;
        break;
      }
      case CommerceEventType.DealCompleted:
      case EventType.DealWon:
      case EventType.DealLost:
      case CommerceEventType.DealCancelled:
        this.state.closed = true;
        break;
    }
  }
}

export { STAGE_ORDER };
