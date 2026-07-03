# Sync Dashboard

UI: `/avito/live` → **Dashboard** tab  
API: `GET /api/avito/live/dashboard?accountId=`

## Metrics

- **Queue depth** — pending sync jobs
- **Active worker** — currently running worker id
- **Requests / hour** — from request log
- **Rate limit remaining** — last known `X-RateLimit-Remaining`

## Worker table

Per worker:

| Column | Source |
| --- | --- |
| Last sync | `AvitoLiveSyncWorkerReadModel.lastSyncAt` |
| Next sync | `nextSyncAt` (lastSync + intervalSec) |
| Status | lastStatus |
| Latency | lastLatencyMs |
| Interval | User-selectable dropdown |
| Retry | retryCount |
| Limitation | Official API constraint text |

Auto-refresh: 30 seconds.

## Actions

- **Полная синхронизация** — `POST /api/avito/live/sync`
- Change interval — `PUT /api/avito/live/schedule`
