# Activity Timeline

Unified event feed from Event Store — messages, deals, AI decisions, automations, listing changes.

## API

`GET /api/commerce/timeline?entityType=&entityId=`

## UI

`/history` — vertical timeline with event type + aggregate context.

No separate aggregate — reads `event_store` directly via `TimelineEngine`.
