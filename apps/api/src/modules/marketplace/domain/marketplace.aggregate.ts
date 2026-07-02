import {
  EventType,
  MarketplaceCode,
  type EventPayloadMap,
} from '@neeklo/contracts';
import { AggregateRoot, type RecordedEvent } from '@neeklo/kernel';

interface MarketplaceState {
  code: MarketplaceCode;
  pluginId: string | null;
  connected: boolean;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  capabilities: string[];
  regionCount: number;
  categoryCount: number;
  accountCount: number;
}

/**
 * Marketplace aggregate — represents a marketplace platform in the system (not a tenant account).
 * Tracks connection state, capabilities, catalog sync status, and health.
 */
export class MarketplaceAggregate extends AggregateRoot {
  private state!: MarketplaceState;

  get aggregateType(): string {
    return 'marketplace';
  }

  get snapshot(): Readonly<MarketplaceState> {
    return this.state;
  }

  static register(id: string, code: MarketplaceCode, pluginId: string): MarketplaceAggregate {
    const mp = new MarketplaceAggregate(id);
    mp.raise(EventType.MarketplaceConnected, {
      marketplace: code,
      pluginId,
      connectedAt: new Date().toISOString(),
    });
    return mp;
  }

  authorize(accountId: string, externalAccountId: string, expiresAt: string | null): void {
    this.raise(EventType.MarketplaceAuthorized, {
      marketplace: this.state.code,
      accountId,
      externalAccountId,
      authorizedAt: new Date().toISOString(),
      expiresAt,
    });
  }

  disconnect(reason: string | null): void {
    this.raise(EventType.MarketplaceDisconnected, {
      marketplace: this.state.code,
      reason,
      disconnectedAt: new Date().toISOString(),
    });
  }

  updateHealth(status: 'healthy' | 'degraded' | 'unhealthy', latencyMs: number, accountId: string | null): void {
    if (this.state.healthStatus === status) return;
    this.raise(EventType.MarketplaceHealthChanged, {
      marketplace: this.state.code,
      accountId,
      status,
      latencyMs,
      changedAt: new Date().toISOString(),
    });
  }

  setCapability(capability: string, supported: boolean): void {
    this.raise(EventType.MarketplaceCapabilityChanged, {
      marketplace: this.state.code,
      capability,
      supported,
      changedAt: new Date().toISOString(),
    });
  }

  protected apply(event: RecordedEvent): void {
    switch (event.type) {
      case EventType.MarketplaceConnected: {
        const p = event.payload as EventPayloadMap['marketplace.connected'];
        this.state = {
          code: p.marketplace,
          pluginId: p.pluginId,
          connected: true,
          healthStatus: 'unknown',
          capabilities: [],
          regionCount: 0,
          categoryCount: 0,
          accountCount: 0,
        };
        break;
      }
      case EventType.MarketplaceDisconnected: {
        this.state.connected = false;
        break;
      }
      case EventType.MarketplaceHealthChanged: {
        const p = event.payload as EventPayloadMap['marketplace.health_changed'];
        this.state.healthStatus = p.status;
        break;
      }
      case EventType.MarketplaceCapabilityChanged: {
        const p = event.payload as EventPayloadMap['marketplace.capability_changed'];
        if (p.supported && !this.state.capabilities.includes(p.capability)) {
          this.state.capabilities.push(p.capability);
        } else if (!p.supported) {
          this.state.capabilities = this.state.capabilities.filter((c) => c !== p.capability);
        }
        break;
      }
      default:
        break;
    }
  }
}
