# Intelligence Engine — Stage 3

The **Intelligence Layer** is the analytical and decision-making core of NEEKLO Marketplace OS. It sits above Event Store projections and Stage 2 engines, consuming the event stream to build warehouses, forecasts, and actionable decisions.

## Architecture

```mermaid
flowchart TB
  EB[Event Bus]
  subgraph Intelligence["Intelligence Layer"]
    PIPE[Intelligence Pipeline]
    HW[Historical Warehouse]
    MW[Metrics Warehouse]
    FE[Forecast Engine]
    DE[Decision Engine]
    SE[Strategy Engine]
    RE[Regional Intelligence]
    CE[Competitor Intelligence]
    OE[Opportunity Engine]
    EE[Experiment Engine]
    AM[AI Memory Engine]
    KG2[Knowledge Graph v2]
    OBS[Intelligence Observability]
  end
  ES[(Event Store intelligence stream)]
  API["/api/intelligence/*"]

  EB --> PIPE
  PIPE --> HW --> MW
  MW --> FE --> DE
  SE --> DE
  KG2 --> DE
  RE --> OE
  CE --> DE
  PIPE --> KG2
  DE --> ES
  FE --> ES
  OE --> ES
  API --> Intelligence
```

## Event flow

```mermaid
sequenceDiagram
  participant EB as Event Bus
  participant P as Intelligence Pipeline
  participant H as Historical Warehouse
  participant M as Metrics Warehouse
  participant F as Forecast Engine
  participant D as Decision Engine
  participant ES as Event Store

  EB->>P: ad.* / intelligence.*
  P->>H: ingest counters
  H->>H: cascade rollups hour→year
  P->>M: syncFromHistorical
  P->>F: forecast (on trigger events)
  F->>ES: intelligence.forecast_generated
  P->>D: decide
  D->>ES: intelligence.decision_made
```

## Components

| Engine | Path | Responsibility |
| --- | --- | --- |
| Historical Warehouse | `warehouse/historical-warehouse.engine.ts` | Hour→year rollups from domain events |
| Metrics Warehouse | `warehouse/metrics-warehouse.engine.ts` | Full metrics vector per bucket |
| Forecast Engine | `forecast/` | Pluggable `ForecastProvider` (default: time-series regression) |
| Decision Engine | `decision/decision.engine.ts` | Strategy-weighted decisions as domain events |
| Strategy Engine | `strategy/strategy.engine.ts` | Tenant strategy profiles |
| Regional Intelligence | `regional/` | Region ranking + opportunity index |
| Competitor Intelligence | `competitor/` | Price/photo/description/rank history |
| Opportunity Engine | `opportunity/` | Scans regions + ads for opportunities |
| Experiment Engine | `experiment/` | A/B/C multivariate tests |
| AI Memory Engine | `memory/` | Long-term structured memory |
| Knowledge Graph v2 | `knowledge-graph/` | BFS traversal + intelligence event ingestion |
| Pipeline | `pipeline/intelligence-pipeline.service.ts` | Orchestration consumer group |

## API

All routes under `/api/intelligence/*` (see `modules/intelligence/intelligence.controller.ts`).

## Scalability notes

- Warehouses are **partitioned by tenant + entity** with indexed time buckets.
- Pipeline uses consumer group `intelligence-pipeline` with checkpoint table.
- Forecast provider is swappable via `FORECAST_PROVIDER` DI token — no API change for ML upgrade.
- No marketplace-specific logic in intelligence core.

## Related docs

- [historical-warehouse.md](./historical-warehouse.md)
- [metrics-warehouse.md](./metrics-warehouse.md)
- [forecast-engine.md](./forecast-engine.md)
- [decision-engine.md](./decision-engine.md)
- [regional-intelligence.md](./regional-intelligence.md)
- [competitor-intelligence.md](./competitor-intelligence.md)
- [strategy-engine.md](./strategy-engine.md)
- [knowledge-graph-v2.md](./knowledge-graph-v2.md)
