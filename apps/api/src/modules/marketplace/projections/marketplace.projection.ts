import { Injectable } from '@nestjs/common';
import { EventType, type EventPayloadMap } from '@neeklo/contracts';
import type { StoredEvent } from '@neeklo/kernel';
import type { Projection, ProjectionTx } from '../../../platform/projections/projection';

const HANDLED = new Set([
  EventType.MarketplaceConnected,
  EventType.MarketplaceDisconnected,
  EventType.MarketplaceHealthChanged,
  EventType.MarketplaceCapabilityChanged,
  EventType.MarketplacePluginInstalled,
]);

@Injectable()
export class MarketplaceProjection implements Projection {
  readonly name = 'marketplace_read_model';
  readonly handles = HANDLED;

  async project(event: StoredEvent, tx: ProjectionTx): Promise<void> {
    const at = new Date(event.occurredAt);
    switch (event.type) {
      case EventType.MarketplaceConnected: {
        const p = event.payload as EventPayloadMap['marketplace.connected'];
        await tx.marketplaceReadModel.upsert({
          where: { marketplace: p.marketplace },
          create: {
            id: event.aggregateId,
            marketplace: p.marketplace,
            pluginId: p.pluginId,
            connected: true,
            updatedAt: at,
          },
          update: { pluginId: p.pluginId, connected: true, updatedAt: at },
        });
        break;
      }
      case EventType.MarketplaceDisconnected: {
        const p = event.payload as EventPayloadMap['marketplace.disconnected'];
        await tx.marketplaceReadModel.update({
          where: { marketplace: p.marketplace },
          data: { connected: false, updatedAt: at },
        });
        break;
      }
      case EventType.MarketplaceHealthChanged: {
        const p = event.payload as EventPayloadMap['marketplace.health_changed'];
        await tx.marketplaceReadModel.update({
          where: { marketplace: p.marketplace },
          data: { healthStatus: p.status, updatedAt: at },
        });
        break;
      }
      case EventType.MarketplaceCapabilityChanged: {
        const p = event.payload as EventPayloadMap['marketplace.capability_changed'];
        const row = await tx.marketplaceReadModel.findUnique({ where: { marketplace: p.marketplace } });
        if (!row) break;
        const caps = (row.capabilities as string[]) ?? [];
        const next = p.supported ? [...new Set([...caps, p.capability])] : caps.filter((c) => c !== p.capability);
        await tx.marketplaceReadModel.update({
          where: { marketplace: p.marketplace },
          data: { capabilities: next, updatedAt: at },
        });
        break;
      }
      case EventType.MarketplacePluginInstalled: {
        const p = event.payload as EventPayloadMap['marketplace.plugin_installed'];
        await tx.pluginReadModel.upsert({
          where: { pluginId: p.pluginId },
          create: {
            id: event.aggregateId,
            pluginId: p.pluginId,
            name: p.pluginId,
            version: p.pluginVersion,
            kind: 'marketplace',
            marketplace: p.marketplace,
            state: 'installed',
            installedAt: at,
            updatedAt: at,
          },
          update: { version: p.pluginVersion, state: 'installed', updatedAt: at },
        });
        break;
      }
    }
  }
}
