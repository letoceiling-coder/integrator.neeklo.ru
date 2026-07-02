# Event Catalog

All events are defined in `packages/contracts/src/events/` and validated at append time.

## Namespaces

| Namespace | Aggregate | Events |
| --- | --- | --- |
| `ad.*` | ad | created, published, price_changed, view_recorded, … |
| `conversation.*` | conversation | message_received, ai_reply_sent, … |
| `budget.*` | budget | spent |
| `deal.*` | deal | created, won, lost |
| `marketplace.*` | marketplace | connected, authorized, sync_*, health_changed, plugin_* |
| `organization.*` | organization | created, settings_updated, budget_allocated, … |
| `account.*` | account | created, authorized, sync_*, health_changed, error_recorded |
| `recommendation.*` | recommendation | generated, accepted, dismissed |
| `snapshot.*` | snapshot | created |

## Stage 2 marketplace events

```
marketplace.connected
marketplace.disconnected
marketplace.authorized
marketplace.synchronization_started
marketplace.synchronization_completed
marketplace.synchronization_failed
marketplace.capability_changed
marketplace.health_changed
marketplace.region_updated
marketplace.category_updated
marketplace.limits_changed
marketplace.statistics_imported
marketplace.webhook_received
marketplace.plugin_installed
marketplace.plugin_removed
marketplace.plugin_updated
```

## Rules

1. **Additive only** — never remove or repurpose payload fields
2. **Past tense facts** — `ad.price_changed`, not `change_price`
3. **Validated** — `parseEventPayload()` at Event Store append
4. **Immutable** — rows in `event_store` are never updated or deleted

## Event envelope

Every stored event includes:

- `eventId`, `streamVersion`, `globalPosition`
- `tenantId`, `actor`, `correlationId`, `causationId`
- `occurredAt`, `payload`, `metadata`

## Replay

Any aggregate history can be reconstructed:

```
snapshot (optional) + events[fromVersion..] → fold(apply) → current state
```
