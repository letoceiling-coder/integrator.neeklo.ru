import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { EventType } from '@neeklo/contracts';
import { EVENT_BUS, type EventBus, type StoredEvent } from '@neeklo/kernel';

export interface WorkflowContext {
  tenantId: string;
  correlationId: string;
}

/**
 * A declarative, event-triggered workflow. Automations (auto-reply, auto-boost dying ads,
 * budget guardrails) are expressed as workflows that react to the fact stream.
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  /** Event types that trigger this workflow. */
  triggers: EventType[];
  run(event: StoredEvent, ctx: WorkflowContext): Promise<void>;
}

/**
 * Minimal but real workflow engine: a single durable subscription to the fact stream that
 * fans events out to every registered workflow whose trigger matches. Definitions are
 * registered by feature modules — the engine itself is domain-agnostic.
 */
@Injectable()
export class WorkflowEngine implements OnModuleInit {
  private readonly logger = new Logger(WorkflowEngine.name);
  private readonly workflows = new Map<string, WorkflowDefinition>();

  constructor(@Inject(EVENT_BUS) private readonly bus: EventBus) {}

  register(definition: WorkflowDefinition): void {
    this.workflows.set(definition.id, definition);
    this.logger.log(`Registered workflow: ${definition.name} [${definition.triggers.join(', ')}]`);
  }

  list(): WorkflowDefinition[] {
    return [...this.workflows.values()];
  }

  async onModuleInit(): Promise<void> {
    await this.bus.subscribe((event) => this.dispatch(event), { group: 'workflow-engine' });
  }

  private async dispatch(event: StoredEvent): Promise<void> {
    for (const wf of this.workflows.values()) {
      if (!wf.triggers.includes(event.type)) continue;
      try {
        await wf.run(event, { tenantId: event.tenantId, correlationId: event.correlationId });
      } catch (err) {
        this.logger.error(
          `Workflow ${wf.id} failed on ${event.type} (${event.eventId})`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
