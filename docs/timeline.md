# Marketplace Timeline

UI: `/avito/live` → **Timeline** tab  
API: `GET /api/avito/live/timeline?accountId=&limit=50`

## Event kinds

| kind | Source |
| --- | --- |
| oauth | OAuth flows (via Event Store — future projection) |
| sync | Worker completions + HTTP request log |
| ads | Item sync events |
| messages | Messenger / webhook |
| promotion | Promotion worker |
| webhook | WebhookReceived |
| error | HTTP ≥400 |
| ai | AI actions on read models |

## Current implementation

Merges:

1. `AvitoLiveRequestLogReadModel` for account (API calls)
2. `AvitoLiveSyncWorkerReadModel.lastSyncAt` per worker

Sorted descending by timestamp. Includes `correlationId` when available.

## Event Store

Domain events (`ProfileUpdated`, `ItemsUpdated`, …) are appended to the Avito stream for CQRS projections and AI consumption.
