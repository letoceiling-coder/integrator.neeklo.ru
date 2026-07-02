import {
  AccountStatus,
  EventType,
  MarketplaceCode,
  type EventPayloadMap,
} from '@neeklo/contracts';
import { AggregateRoot, DomainError, type RecordedEvent, type SnapshotCapable } from '@neeklo/kernel';

interface AccountState {
  organizationId: string;
  marketplace: MarketplaceCode;
  displayName: string;
  externalAccountId: string | null;
  status: AccountStatus;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  limits: Record<string, number>;
  lastError: string | null;
  authorized: boolean;
}

/**
 * Marketplace Account aggregate — a tenant's connected account on a specific marketplace.
 */
export class AccountAggregate extends AggregateRoot implements SnapshotCapable {
  private state!: AccountState;

  get aggregateType(): string {
    return 'account';
  }

  get snapshot(): Readonly<AccountState> {
    return this.state;
  }

  static create(
    id: string,
    organizationId: string,
    marketplace: MarketplaceCode,
    displayName: string,
  ): AccountAggregate {
    const account = new AccountAggregate(id);
    account.raise(EventType.AccountCreated, {
      organizationId,
      marketplace,
      displayName,
      createdAt: new Date().toISOString(),
    });
    return account;
  }

  authorize(externalAccountId: string, tokenExpiresAt: string | null): void {
    this.raise(EventType.AccountAuthorized, {
      externalAccountId,
      tokenExpiresAt,
      authorizedAt: new Date().toISOString(),
    });
    this.changeStatus(AccountStatus.ACTIVE, 'authorized');
  }

  failAuthorization(reason: string): void {
    this.raise(EventType.AccountAuthorizationFailed, {
      reason,
      failedAt: new Date().toISOString(),
    });
    this.changeStatus(AccountStatus.ERROR, reason);
  }

  changeStatus(to: AccountStatus, reason: string | null = null): void {
    if (this.state.status === to) return;
    this.raise(EventType.AccountStatusChanged, { from: this.state.status, to, reason });
  }

  updateLimits(limits: Record<string, number>): void {
    this.raise(EventType.AccountLimitsUpdated, {
      limits,
      updatedAt: new Date().toISOString(),
    });
  }

  startSync(syncId: string, mode: 'full' | 'incremental' | 'reconcile'): void {
    this.raise(EventType.AccountSyncStarted, {
      syncId,
      mode,
      startedAt: new Date().toISOString(),
    });
  }

  completeSync(
    syncId: string,
    stats: { created: number; updated: number; deleted: number; restored: number; skipped: number; conflicts: number },
  ): void {
    this.raise(EventType.AccountSyncCompleted, {
      syncId,
      stats,
      completedAt: new Date().toISOString(),
    });
  }

  failSync(syncId: string, error: string): void {
    this.raise(EventType.AccountSyncFailed, { syncId, error, failedAt: new Date().toISOString() });
    this.recordError('sync_failed', error, true);
  }

  updateHealth(status: 'healthy' | 'degraded' | 'unhealthy', latencyMs: number): void {
    this.raise(EventType.AccountHealthChanged, {
      status,
      latencyMs,
      changedAt: new Date().toISOString(),
    });
  }

  recordError(code: string, message: string, recoverable: boolean): void {
    this.raise(EventType.AccountErrorRecorded, {
      code,
      message,
      recoverable,
      recordedAt: new Date().toISOString(),
    });
  }

  toSnapshot(): Record<string, unknown> {
    return { ...this.state };
  }

  fromSnapshot(state: Record<string, unknown>): void {
    this.state = state as AccountState;
  }

  protected apply(event: RecordedEvent): void {
    switch (event.type) {
      case EventType.AccountCreated: {
        const p = event.payload as EventPayloadMap['account.created'];
        this.state = {
          organizationId: p.organizationId,
          marketplace: p.marketplace,
          displayName: p.displayName,
          externalAccountId: null,
          status: AccountStatus.PENDING,
          healthStatus: 'unknown',
          limits: {},
          lastError: null,
          authorized: false,
        };
        break;
      }
      case EventType.AccountAuthorized: {
        const p = event.payload as EventPayloadMap['account.authorized'];
        this.state.externalAccountId = p.externalAccountId;
        this.state.authorized = true;
        break;
      }
      case EventType.AccountStatusChanged: {
        const p = event.payload as EventPayloadMap['account.status_changed'];
        this.state.status = p.to;
        break;
      }
      case EventType.AccountLimitsUpdated: {
        const p = event.payload as EventPayloadMap['account.limits_updated'];
        this.state.limits = p.limits;
        break;
      }
      case EventType.AccountHealthChanged: {
        const p = event.payload as EventPayloadMap['account.health_changed'];
        this.state.healthStatus = p.status;
        break;
      }
      case EventType.AccountErrorRecorded: {
        const p = event.payload as EventPayloadMap['account.error_recorded'];
        this.state.lastError = p.message;
        break;
      }
      default:
        break;
    }
  }
}
