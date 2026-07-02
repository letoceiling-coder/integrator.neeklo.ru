import { EventType, type EventPayloadMap } from '@neeklo/contracts';
import { AggregateRoot, type RecordedEvent, type SnapshotCapable } from '@neeklo/kernel';

interface OrganizationState {
  tenantId: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  aiSettings: Record<string, string>;
  budgetTotal: number;
  apiKeyCount: number;
}

/**
 * Organization aggregate. Maps 1:1 to Tenant in persistence for backward compatibility.
 */
export class OrganizationAggregate extends AggregateRoot implements SnapshotCapable {
  private state!: OrganizationState;

  get aggregateType(): string {
    return 'organization';
  }

  get snapshot(): Readonly<OrganizationState> {
    return this.state;
  }

  static create(id: string, name: string, slug: string): OrganizationAggregate {
    const org = new OrganizationAggregate(id);
    org.raise(EventType.OrganizationCreated, { name, slug });
    return org;
  }

  updateSettings(settings: Record<string, unknown>): void {
    this.raise(EventType.OrganizationSettingsUpdated, {
      settings,
      updatedAt: new Date().toISOString(),
    });
  }

  allocateBudget(budgetId: string, amount: { amount: number; currency: string }, period: 'daily' | 'weekly' | 'monthly'): void {
    this.raise(EventType.OrganizationBudgetAllocated, {
      budgetId,
      amount,
      period,
      allocatedAt: new Date().toISOString(),
    });
  }

  updateAiSettings(models: Record<string, string>): void {
    this.raise(EventType.OrganizationAiSettingsUpdated, {
      models,
      updatedAt: new Date().toISOString(),
    });
  }

  toSnapshot(): Record<string, unknown> {
    return { ...this.state };
  }

  fromSnapshot(state: Record<string, unknown>): void {
    this.state = state as OrganizationState;
  }

  protected apply(event: RecordedEvent): void {
    switch (event.type) {
      case EventType.OrganizationCreated: {
        const p = event.payload as EventPayloadMap['organization.created'];
        this.state = {
          tenantId: this.id,
          name: p.name,
          slug: p.slug,
          settings: {},
          aiSettings: {},
          budgetTotal: 0,
          apiKeyCount: 0,
        };
        break;
      }
      case EventType.OrganizationSettingsUpdated: {
        const p = event.payload as EventPayloadMap['organization.settings_updated'];
        this.state.settings = p.settings;
        break;
      }
      case EventType.OrganizationBudgetAllocated: {
        const p = event.payload as EventPayloadMap['organization.budget_allocated'];
        this.state.budgetTotal += p.amount.amount;
        break;
      }
      case EventType.OrganizationAiSettingsUpdated: {
        const p = event.payload as EventPayloadMap['organization.ai_settings_updated'];
        this.state.aiSettings = p.models;
        break;
      }
      default:
        break;
    }
  }
}
