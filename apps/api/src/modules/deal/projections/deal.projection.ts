import { Injectable } from '@nestjs/common';
import { CommerceEventType, DealStage, EventType } from '@neeklo/contracts';
import type { StoredEvent } from '@neeklo/kernel';
import type { Projection, ProjectionTx } from '../../../platform/projections/projection';

const HANDLED = new Set([
  EventType.DealCreated,
  EventType.DealWon,
  EventType.DealLost,
  CommerceEventType.DealStageChanged,
  CommerceEventType.DealOfferMade,
  CommerceEventType.DealPaid,
  CommerceEventType.DealCompleted,
  CommerceEventType.DealCancelled,
  CommerceEventType.DealAiStageSuggested,
]);

@Injectable()
export class DealProjection implements Projection {
  readonly name = 'deal_read_model';
  readonly handles = HANDLED;

  async project(event: StoredEvent, tx: ProjectionTx): Promise<void> {
    const at = new Date(event.occurredAt);

    switch (event.type) {
      case EventType.DealCreated: {
        const p = event.payload as { customerId: string; adId: string | null; expectedAmount: { amount: number; currency: string } };
        const customer = await tx.customerReadModel.findUnique({ where: { id: p.customerId } });
        let adTitle: string | null = null;
        if (p.adId) {
          const ad = await tx.adReadModel.findUnique({ where: { id: p.adId } });
          adTitle = ad?.title ?? null;
        }
        await tx.dealReadModel.upsert({
          where: { id: event.aggregateId },
          create: {
            id: event.aggregateId,
            tenantId: event.tenantId,
            customerId: p.customerId,
            customerName: customer?.displayName ?? 'Клиент',
            adId: p.adId,
            adTitle,
            stage: DealStage.LEAD,
            expectedAmount: p.expectedAmount.amount,
            expectedCurrency: p.expectedAmount.currency,
            createdAt: at,
            updatedAt: at,
          },
          update: { updatedAt: at },
        });
        break;
      }
      case CommerceEventType.DealStageChanged: {
        const p = event.payload as { to: string };
        await tx.dealReadModel.update({ where: { id: event.aggregateId }, data: { stage: p.to, updatedAt: at } });
        break;
      }
      case CommerceEventType.DealAiStageSuggested: {
        const p = event.payload as { suggestedStage: string; confidence: number };
        await tx.dealReadModel.update({
          where: { id: event.aggregateId },
          data: { aiSuggestedStage: p.suggestedStage, aiConfidence: p.confidence, updatedAt: at },
        });
        break;
      }
      case CommerceEventType.DealPaid: {
        const p = event.payload as { amount: { amount: number; currency: string } };
        await tx.dealReadModel.update({
          where: { id: event.aggregateId },
          data: { actualAmount: p.amount.amount, actualCurrency: p.amount.currency, updatedAt: at },
        });
        break;
      }
      case EventType.DealWon:
      case CommerceEventType.DealCompleted: {
        const p = event.payload as { amount?: { amount: number; currency: string }; completedAt?: string; closedAt?: string };
        const amount = p.amount;
        await tx.dealReadModel.update({
          where: { id: event.aggregateId },
          data: {
            stage: DealStage.COMPLETED,
            ...(amount ? { actualAmount: amount.amount, actualCurrency: amount.currency } : {}),
            closedAt: at,
            updatedAt: at,
          },
        });
        break;
      }
      case EventType.DealLost:
      case CommerceEventType.DealCancelled:
        await tx.dealReadModel.update({
          where: { id: event.aggregateId },
          data: { stage: DealStage.CANCELLED, closedAt: at, updatedAt: at },
        });
        break;
    }
  }
}
