# AI Sales Agent

API: `GET/PUT /api/avito/sales/agent/config`, `POST /api/avito/sales/agent/reply`

Per-account config in `AvitoSalesAgentConfigReadModel`:

- enabled, working hours, tone
- maxDiscountPct, maxPriceRub
- handoffToManager
- useKnowledgeBase, useHistory, useCrm, useForecast, useDecisionEngine, useMemory

Execution via existing `SalesAgentService` → `AiGatewayService` (AI Platform unchanged).

Smart Replies: `POST /api/avito/sales/smart-replies` — 5 variants.
