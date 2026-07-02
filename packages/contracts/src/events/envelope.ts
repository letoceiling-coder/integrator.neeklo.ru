import { z } from 'zod';

/**
 * Who or what caused an event. Every event is attributable — this is what lets the AI
 * learn from *real actions and their results*, and lets us replay an ad's history "by seconds".
 */
export const ActorType = {
  USER: 'user',
  AI: 'ai',
  SYSTEM: 'system',
  MARKETPLACE: 'marketplace',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const actorSchema = z.object({
  type: z.nativeEnum(ActorType),
  /** User id, AI agent id, or adapter code depending on `type`. Null for anonymous system ticks. */
  id: z.string().nullable(),
});
export type Actor = z.infer<typeof actorSchema>;

/**
 * The immutable envelope wrapping every domain event in the store.
 * Payload is validated by the per-type schema in the catalog.
 */
export const eventEnvelopeSchema = z.object({
  /** Globally unique id for this event occurrence. */
  eventId: z.string().uuid(),
  /** Monotonic, gap-free position within a single aggregate stream (optimistic concurrency). */
  streamVersion: z.number().int().nonnegative(),
  /** Global ordering assigned by the store on append (bigserial). Absent before persistence. */
  globalPosition: z.string().optional(),
  /** Discriminator, e.g. "ad.created". */
  type: z.string(),
  /** Aggregate kind, e.g. "ad", "conversation", "deal", "budget". */
  aggregateType: z.string(),
  /** Aggregate instance id. */
  aggregateId: z.string(),
  /** Tenant (organization) that owns the stream — every query is tenant-scoped. */
  tenantId: z.string(),
  actor: actorSchema,
  /** Ties together everything triggered by one intent (a command, a webhook, an AI run). */
  correlationId: z.string(),
  /** The event/command that directly caused this event. Null for roots. */
  causationId: z.string().nullable(),
  /** When the fact happened (source of truth for replay). ISO-8601. */
  occurredAt: z.string().datetime(),
  /** Free-form, non-authoritative context (ip, userAgent, adapter request id, …). */
  metadata: z.record(z.unknown()).default({}),
  /** Event-specific body, validated by the catalog schema for `type`. */
  payload: z.record(z.unknown()),
});

export type EventEnvelope<TPayload = Record<string, unknown>> = Omit<
  z.infer<typeof eventEnvelopeSchema>,
  'payload'
> & { payload: TPayload };
