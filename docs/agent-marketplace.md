# Agent Marketplace

`AgentMarketplaceService` exposes the **tenant agent catalog** — sorted by rating and run count for discovery in AI Studio and dashboard.

## Catalog query

```typescript
catalog(tenantId) → agentDefinitionReadModel[]
  where: { tenantId, enabled: true }
  orderBy: [{ rating: desc }, { runCount: desc }]
```

## Architecture

```mermaid
flowchart TB
  subgraph UI["Web"]
    STUDIO["/ai/studio"]
    DASH["/ai/dashboard API"]
  end
  subgraph API["/api/ai"]
    GET_AGENTS[GET /agents]
    DASHBOARD[GET /dashboard]
  end
  subgraph Svc["Services"]
    MKT[AgentMarketplaceService]
    AR[AgentRuntimeService]
  end

  STUDIO --> GET_AGENTS
  DASH --> DASHBOARD
  GET_AGENTS --> MKT
  DASHBOARD --> MKT
  POST agents --> AR
```

## vs Agent Runtime

| Service | Responsibility |
| --- | --- |
| `AgentRuntimeService` | CRUD, resolve, recordRun |
| `AgentMarketplaceService` | Read-optimized catalog views |

Same underlying table — marketplace is the query facade for UI.

## Future: shared templates

Cross-tenant **agent templates** (NEEKLO-provided sales/listing agents) would layer above tenant copies — not in 0.5 schema; catalog is tenant-private only.

## API

- `GET /api/ai/agents` — marketplace catalog
- `GET /api/ai/dashboard` — includes `agents: count`

## ADR

**Decision:** Marketplace is catalog-only in 0.5 — no billing, publishing, or third-party agents.

**Consequences:**
- (+) Fast UI integration
- (-) External agent store deferred

## Path

`apps/api/src/platform/ai-platform/agents/agent-runtime.service.ts` (`AgentMarketplaceService`)

## See also

- [agent-runtime.md](./agent-runtime.md) · [ai-studio.md](./ai-studio.md) · [commerce-platform.md](./commerce-platform.md)
