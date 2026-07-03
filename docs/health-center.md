# Health Center (Avito Live)

UI: `/avito/live` → **Health** tab  
API: `GET /api/avito/live/health?accountId=`

## Checks

| Check | Meaning |
| --- | --- |
| oauth | OAuth Center available (read-only probe) |
| vault | Credential Vault available |
| avitoApi | At least one worker completed successfully |
| webhook | Webhook received at least once |
| sync | All workers completed vs total |
| queues | Queue depth ≤10 |
| workers | Active worker count |
| readModels | Snapshot count >0 |
| storage | PostgreSQL read models |
| ai | AI uses read models only — no direct Avito API |

Status: `pass` | `warn` | `fail`

Auto-refresh: 60 seconds.

## Platform health

Global OAuth/Vault health remains in `/settings/oauth`. Avito Live Health is account-scoped.
