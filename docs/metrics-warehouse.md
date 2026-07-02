# Metrics Warehouse

Central store for **all computed business metrics**. Formulas delegate to Stage 2 `MetricsEngine`; extended scores (listing, opportunity, media) are derived in `MetricsWarehouseEngine`.

## Metrics vector

| Metric | Source |
| --- | --- |
| CTR, ROI, ROAS, CPA, CPC, CPM | MetricsEngine |
| Conversion, Engagement, Response Time | MetricsEngine |
| Cost, Revenue, Average Check | Historical counters |
| Media Score, Listing Score | Derived from AI score + CTR + popularity |
| AI Score | MetricsEngine input |
| Regional / Competition / Forecast Score | Populated by regional/competitor/forecast engines |
| Opportunity Score | popularity × ROI |

## Persistence

Prisma model: `MetricsWarehouseRow` — keyed by `(tenantId, entityType, entityId, granularity, periodStart)`.

## Events

Each persist emits `intelligence.metrics_warehouse_updated`.

## API

`GET /api/intelligence/metrics?entityType=ad&entityId={id}&granularity=day`

## Design rules

- **Single source of formulas** — never duplicate CTR/ROI math in controllers or UI.
- Sync path: `syncFromHistorical()` reads latest historical bucket → computes → persists.
