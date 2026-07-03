# Executive AI

API: `GET /api/avito/automation/executive`, `POST /api/avito/automation/executive/refresh`

Plain-language business summary for the owner:

- What is happening
- Highlights, risks, opportunities
- Cached 1 hour in `AvitoExecutiveAiSnapshotReadModel`

Sources: `AvitoAnalyticsCenterService`, AI Observatory, `OpportunityEngine`.

UI: `/avito/automation` → Executive AI tab.

## Phase A6 Final Audit

| Area | Status |
| --- | --- |
| Recommendation quality | Heuristics + AI Gateway, confidence scores |
| No duplication | Observatory dedupe + unique `dedupeKey` |
| Read models | AdReadModel, DecisionReadModel, OpportunityReadModel, MetricsWarehouse |
| Intelligence Platform | ForecastEngine, DecisionEngine, OpportunityEngine, MetricsWarehouse |
| AI Platform | AiGatewayService for reports, price, content, executive |
| No irreversible auto-actions | Price/content = recommend only; rules = notify/task/recommend |
| Documentation | 6 docs + this audit |

Route: `/avito/automation` · API: `/api/avito/automation/*`
