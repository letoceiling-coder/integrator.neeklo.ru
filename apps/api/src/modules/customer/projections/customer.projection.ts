import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { CommerceEventType } from '@neeklo/contracts';
import type { StoredEvent } from '@neeklo/kernel';
import type { Projection, ProjectionTx } from '../../../platform/projections/projection';

const HANDLED = new Set([
  CommerceEventType.CustomerCreated,
  CommerceEventType.CustomerUpdated,
  CommerceEventType.CustomerInterestRecorded,
]);

@Injectable()
export class CustomerProjection implements Projection {
  readonly name = 'customer_read_model';
  readonly handles = HANDLED;

  async project(event: StoredEvent, tx: ProjectionTx): Promise<void> {
    const at = new Date(event.occurredAt);

    switch (event.type) {
      case CommerceEventType.CustomerCreated: {
        const p = event.payload as {
          displayName: string;
          phone: string | null;
          email: string | null;
          channel: string;
          externalId: string | null;
          cityIds: string[];
        };
        await tx.customerReadModel.upsert({
          where: { id: event.aggregateId },
          create: {
            id: event.aggregateId,
            tenantId: event.tenantId,
            displayName: p.displayName,
            phone: p.phone,
            email: p.email,
            channel: p.channel,
            externalId: p.externalId,
            cityIds: p.cityIds,
            lastActivityAt: at,
            createdAt: at,
            updatedAt: at,
          },
          update: { updatedAt: at },
        });
        await tx.searchIndexEntry.upsert({
          where: { tenantId_entityType_entityId: { tenantId: event.tenantId, entityType: 'customer', entityId: event.aggregateId } },
          create: {
            tenantId: event.tenantId,
            entityType: 'customer',
            entityId: event.aggregateId,
            title: p.displayName,
            body: [p.phone, p.email].filter(Boolean).join(' '),
            updatedAt: at,
          },
          update: { title: p.displayName, updatedAt: at },
        });
        break;
      }
      case CommerceEventType.CustomerUpdated: {
        const p = event.payload as Record<string, unknown>;
        await tx.customerReadModel.update({
          where: { id: event.aggregateId },
          data: {
            ...(p.displayName ? { displayName: p.displayName as string } : {}),
            ...(p.phone !== undefined ? { phone: p.phone as string | null } : {}),
            ...(p.email !== undefined ? { email: p.email as string | null } : {}),
            ...(p.cityIds ? { cityIds: p.cityIds as string[] } : {}),
            ...(p.preferences ? { preferences: p.preferences as object } : {}),
            lastActivityAt: at,
            updatedAt: at,
          },
        });
        break;
      }
      case CommerceEventType.CustomerInterestRecorded: {
        const p = event.payload as { interest: string; score: number };
        const customer = await tx.customerReadModel.findUnique({ where: { id: event.aggregateId } });
        if (!customer) break;
        const interests = customer.interests.includes(p.interest) ? customer.interests : [...customer.interests, p.interest];
        await tx.customerReadModel.update({
          where: { id: event.aggregateId },
          data: {
            interests,
            purchaseProbability: Math.min(0.99, p.score / 100),
            lastActivityAt: at,
            updatedAt: at,
          },
        });
        break;
      }
    }
  }
}
