import { Injectable } from '@nestjs/common';
import { EventType, type EventPayloadMap } from '@neeklo/contracts';
import type { StoredEvent } from '@neeklo/kernel';
import type { Projection, ProjectionTx } from '../../../platform/projections/projection';

const HANDLED = new Set([
  EventType.AccountCreated,
  EventType.AccountAuthorized,
  EventType.AccountStatusChanged,
  EventType.AccountLimitsUpdated,
  EventType.AccountHealthChanged,
  EventType.AccountSyncCompleted,
  EventType.AccountErrorRecorded,
]);

@Injectable()
export class AccountProjection implements Projection {
  readonly name = 'account_read_model';
  readonly handles = HANDLED;

  async project(event: StoredEvent, tx: ProjectionTx): Promise<void> {
    const at = new Date(event.occurredAt);
    switch (event.type) {
      case EventType.AccountCreated: {
        const p = event.payload as EventPayloadMap['account.created'];
        await tx.accountReadModel.upsert({
          where: { id: event.aggregateId },
          create: {
            id: event.aggregateId,
            organizationId: p.organizationId,
            marketplace: p.marketplace,
            displayName: p.displayName,
            status: 'pending',
            createdAt: at,
            updatedAt: at,
          },
          update: {},
        });
        break;
      }
      case EventType.AccountAuthorized: {
        const p = event.payload as EventPayloadMap['account.authorized'];
        await tx.accountReadModel.update({
          where: { id: event.aggregateId },
          data: { externalAccountId: p.externalAccountId, status: 'active', updatedAt: at },
        });
        break;
      }
      case EventType.AccountStatusChanged: {
        const p = event.payload as EventPayloadMap['account.status_changed'];
        await tx.accountReadModel.update({
          where: { id: event.aggregateId },
          data: { status: p.to, updatedAt: at },
        });
        break;
      }
      case EventType.AccountLimitsUpdated: {
        const p = event.payload as EventPayloadMap['account.limits_updated'];
        await tx.accountReadModel.update({
          where: { id: event.aggregateId },
          data: { limits: p.limits, updatedAt: at },
        });
        break;
      }
      case EventType.AccountHealthChanged: {
        const p = event.payload as EventPayloadMap['account.health_changed'];
        await tx.accountReadModel.update({
          where: { id: event.aggregateId },
          data: { healthStatus: p.status, updatedAt: at },
        });
        break;
      }
      case EventType.AccountSyncCompleted: {
        await tx.accountReadModel.update({
          where: { id: event.aggregateId },
          data: { lastSyncAt: at, updatedAt: at },
        });
        break;
      }
      case EventType.AccountErrorRecorded: {
        const p = event.payload as EventPayloadMap['account.error_recorded'];
        await tx.accountReadModel.update({
          where: { id: event.aggregateId },
          data: { lastError: p.message, updatedAt: at },
        });
        break;
      }
    }
  }
}
