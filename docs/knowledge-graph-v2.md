# Knowledge Graph v2

Extends Stage 2 `KnowledgeGraphService` with **intelligence-layer nodes**, **BFS traversal**, and **intelligence event ingestion**.

## New node kinds

organization, user, account, ad, customer, conversation, message, region, competitor, budget, media, campaign, event, recommendation, marketplace — plus v2:

- employee, city, campaign, decision, forecast, experiment, metric

## New relations

- `works_for`, `located_in_city`, `part_of_campaign`
- `decided`, `forecasts`, `tests`, `measures`, `recommends_action`

## Intelligence event ingestion

| Event | Graph update |
| --- | --- |
| decision_made | Decision node → entity via `decided` |
| forecast_generated | Forecast node → entity via `forecasts` |
| opportunity_detected | Opportunity node → entity via `recommends` |
| message_received | Customer → ad via `messaged_in` |
| ad.created | Ad → city via `located_in_city` |

## Query API

`GET /api/intelligence/graph/:kind/:entityId?depth=2`

Returns `{ nodes[], edges[] }` from BFS traversal up to `depth` hops.

## Performance

- Edges capped at 50 per hop to bound query cost at scale.
- Indexed by `(tenantId, kind, entityId)` on `KnowledgeNode`.

## v1 compatibility

`KnowledgeGraphV2Service.ingestEvent()` delegates to v1 for all Stage 2 domain events.
