# Price Intelligence

API: `GET /api/avito/automation/price`, `POST /api/avito/automation/price/generate`

AI recommends raising, lowering, or holding price based on:

- `MetricsWarehouseEngine` (CTR, ROI, opportunity score)
- `DecisionEngine` signals
- `AiGatewayService` analytics task

**Recommendations only** — no automatic price updates. User applies changes via Operations Center bulk ops or manual edit.

Read model: `AvitoPriceRecommendationReadModel`
