# Production Readiness

UI: `/avito/production`  
API: `/api/avito/production/readiness`

Aggregates checks across OAuth, Webhook, Sync, Messenger, Feed, CRM, Automation, AI Watchers, Storage, Live Health.

Score ≥ 70% + OAuth pass → `ready: true`.

See also: [installation-wizard.md](./installation-wizard.md), [monitoring.md](./monitoring.md)
