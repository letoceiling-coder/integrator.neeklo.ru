# AI Watchers

API: `GET/POST /api/avito/automation/watchers`, `POST /api/avito/automation/watchers/evaluate`

Each watcher monitors a business metric:

CTR, views, contacts, favorites, ROI, ROAS, CPA, promotion cost, budget, region, sales, conversion, messages.

## Capabilities

- Observe current value via `MetricsWarehouseEngine` + `AdReadModel`
- Compare with previous period (`compareDays`)
- Detect anomalies, growth, decline (`anomalyThresholdPct`)
- Forecast via `ForecastEngine`
- Create recommendations in AI Observatory (`AvitoObservatoryItemReadModel`)

Read model: `AvitoAiWatcherReadModel`
