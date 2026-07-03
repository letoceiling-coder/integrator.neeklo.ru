# Avito Live Sync Engine

`AvitoLiveSyncEngineService` runs official Avito API workers and persists results to read models.

## Queue

In-memory FIFO queue per API instance:

- `{ tenantId, accountId }` — full sync (all enabled workers in order)
- `{ tenantId, accountId, worker }` — single worker

`processQueue(maxJobs)` drains up to `maxJobs` entries sequentially.

## Full sync order

1. Profile → Items → Categories → Tariff → Messenger → Stats → Promotion → Autoload → Hierarchy → Phones → Employees → Ratings → Reviews → Stock → Call Tracking → Api Catalog

Delivery and Jobs workers are disabled (`unavailable`) — no official REST endpoints in current OpenAPI bundle.

## Worker execution

Each worker:

1. Sets status `running`
2. Calls Avito via `AvitoClient` (tokens from Credential Vault)
3. Logs request to `AvitoLiveRequestLogReadModel`
4. Upserts snapshot / ads read models
5. Updates worker row (lastSyncAt, nextSyncAt, counts, version)
6. Publishes `SyncWorkerCompleted` + domain event (`ProfileUpdated`, etc.)

## Retry

Failed workers increment `retryCount`. Scheduler re-enqueues when `nextSyncAt <= now`.

## API catalog worker

Reads `docs/avito-openapi/*.json` and stores available operations in snapshot domain `api_catalog`.

## Orchestrator integration

`AvitoSyncOrchestratorService.syncAccount()` delegates to the live engine (replaces legacy analytics-only pull).
