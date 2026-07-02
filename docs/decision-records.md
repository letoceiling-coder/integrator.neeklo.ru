# Architecture Decision Records (ADR)

## ADR-001: Event Sourcing as system of record

**Status:** Accepted (Stage 1)

All significant facts are append-only events. Read models are disposable projections.

---

## ADR-002: Marketplace SDK + Plugin Runtime (Stage 2)

**Status:** Accepted

**Context:** Need 100+ marketplaces without core changes.

**Decision:** Every marketplace implements `MarketplaceProvider` via plugin. Core resolves capabilities by name.

**Consequences:**
- (+) Avito becomes a plugin, not special code
- (+) Ozon/WB/VK added in ~1 week each
- (-) Two abstraction layers during migration (SDK + legacy bridge)

---

## ADR-003: Organization maps to Tenant

**Status:** Accepted

**Decision:** `OrganizationAggregate.id === Tenant.id` for backward compatibility with existing auth/RBAC.

---

## ADR-004: Metrics Engine centralization

**Status:** Accepted (Stage 2 improvement)

**Decision:** All CTR/ROI/ROAS calculations in `MetricsEngine`. Projections delegate.

---

## ADR-005: Snapshot layer

**Status:** Accepted

**Decision:** Postgres `aggregate_snapshot` table; snapshot every 100 events after minimum 50.

**Not yet wired:** Automatic snapshot on every repository save (next iteration).

---

## ADR-006: Knowledge Graph for AI context

**Status:** Accepted

**Decision:** Graph updated from event stream; AI gets graph + recommendations, not raw events.

---

## ADR-007: Legacy AdapterRegistry bridge

**Status:** Accepted

**Decision:** `AdapterRegistry` delegates to `MarketplaceRegistryService` via `ProviderAdapterBridge`.

Preserves Stage 1 API surface.

---

## Known gaps (audit — Stage 2)

| Gap | Severity | Recommendation |
| --- | --- | --- |
| Snapshot not auto-triggered on save | Medium | Wire `SnapshotEngine.maybeSnapshot` in repository |
| Avito sync/publication unsupported | Expected | Autoload feed module (Stage 3) |
| CQRS buses not implemented | Low | Keep direct services or implement Nest CQRS module |
| BullMQ unused | Low | Use for sync job queue at scale |
| Organization projection missing | Medium | Add `OrganizationProjection` |
| Per-tenant plugin credentials | High | Credential vault aggregate (Stage 3) |
| Event store partitioning | High | Partition by tenant/month at 1B+ events |
| Webhook ingress endpoint | Medium | `POST /webhooks/:marketplace` |
| Agent Engine | Medium | Wire AI tools to RecommendationEngine |

## Improvements implemented in Stage 2

1. Full Marketplace SDK (30 capability interfaces)
2. Plugin Runtime with lifecycle
3. Marketplace / Organization / Account aggregates
4. Extended event catalog (16+ marketplace events)
5. Sync, Snapshot, Metrics, Analytics, Recommendation engines
6. Knowledge Graph
7. Domain policies + 11 domain services
8. Observability (audit log + telemetry spans)
9. Avito as plugin + legacy bridge
10. AdProjection → MetricsEngine delegation

---

## ADR-008: Separate analytics warehouses (Stage 3)

**Status:** Accepted

**Decision:** Event Store remains the source of truth. Historical and Metrics warehouses are disposable read-optimized layers for forecasting and dashboards.

**Consequences:**
- (+) Forecast/decision pipelines never scan raw event log
- (+) Rollups cascade automatically hour→year
- (-) Additional storage and pipeline latency

---

## ADR-009: Pluggable ForecastProvider

**Status:** Accepted

**Decision:** `ForecastEngine` depends on `FORECAST_PROVIDER` token. Default: time-series linear regression. ML models swap via DI without API changes.

---

## ADR-010: Decisions as domain events

**Status:** Accepted

**Decision:** All Decision Engine outputs append to `intelligence` stream as `intelligence.decision_*` events and persist to `DecisionReadModel`.

---

## ADR-011: Intelligence Pipeline consumer group

**Status:** Accepted

**Decision:** `IntelligencePipelineService` subscribes with group `intelligence-pipeline`, checkpointed in `IntelligencePipelineCheckpoint`. Runs parallel to `analytics-engine` group.

---

## ADR-012: Strategy-weighted decisions

**Status:** Accepted

**Decision:** Tenant strategy profile (`StrategyReadModel`) supplies weights consumed by `DecisionEngine.scoreAction()`.

---

## Stage 3 audit (final)

### DDD / CQRS / Event Sourcing compliance

| Check | Result |
| --- | --- |
| Domain events for decisions/forecasts/opportunities | ✅ Intelligence event catalog |
| Command/query separation | ✅ Writes via engines; reads via `/intelligence/*` |
| Event Store as SoT | ✅ Warehouses are projections |
| No marketplace branching in core | ✅ Verified |

### Bottlenecks identified

| Area | Risk | Mitigation |
| --- | --- | --- |
| Forecast on every trigger event | CPU at high volume | Debounce / batch queue (BullMQ) |
| Regional refresh full scan | O(ads) per request | Cache + incremental updates |
| Knowledge Graph BFS | Edge explosion | 50-edge cap per hop (implemented) |
| Intelligence stream concurrency | Hot tenant streams | Partition stream key by entity |
| Event store at 1B+ events | Read latency | Monthly partition + archival (ADR backlog) |

### Logic duplication check

| Metric formulas | Single source: `MetricsEngine` + `MetricsWarehouseEngine` |
| Forecast math | Single source: `ForecastProvider` implementations |
| Recommendations vs decisions | Separate engines; decisions use strategy weights |

### Horizontal scaling readiness

- Intelligence pipeline: separate consumer group, stateless engines
- Warehouses: tenant-partitioned indexes
- Forecast provider: swappable for external ML service

### Backward compatibility

- Stage 1/2 modules unchanged
- `MarketplaceForecastService` delegates to `ForecastEngine` when available
- Organization id = Tenant id preserved

## Known gaps (post Stage 3)

| Gap | Severity | Recommendation |
| --- | --- | --- |
| Snapshot not auto-triggered on save | Medium | Wire `SnapshotEngine.maybeSnapshot` in repository |
| Pipeline forecast debouncing | Medium | Queue trigger events |
| Competitor observations from sync | Medium | Wire Avito sync to `CompetitorIntelligenceEngine` |
| ML ForecastProvider | Low | Bind custom provider when model ready |
| Event store partitioning | High | Partition by tenant/month at 1B+ events |
| Credential vault | High | Stage 4 |
| CQRS buses | Low | Optional Nest CQRS module |

## Improvements implemented in Stage 3

1. Historical Data Warehouse (hour→year rollups)
2. Metrics Warehouse (full KPI vector)
3. Forecast Engine with pluggable provider
4. Decision Engine + Strategy Engine
5. Regional, Competitor, Opportunity engines
6. Experiment Engine + AI Memory Engine
7. Knowledge Graph v2 (BFS + intelligence ingestion)
8. Intelligence Pipeline + observability
9. Intelligence API (`/api/intelligence/*`)
10. Intelligence event catalog + Prisma models
11. Documentation suite + architecture audit

---

## ADR-013: Commerce Platform as operational layer (Release 0.4)

**Status:** Accepted

**Decision:** Release 0.4 adds Commerce Platform (inbox, customer, deals, studios, agent) as an extension layer — not a CRM. All sales aggregates event-sourced; intelligence engines reused via DI.

---

## Release 0.4 audit (final)

### Architecture compliance

| Check | Result |
| --- | --- |
| Event Sourcing for inbox/customer/deals | ✅ |
| CQRS read/write split | ✅ |
| No duplicate metrics logic | ✅ Budget → AdReadModel + MetricsEngine |
| Intelligence reuse | ✅ Agent uses Memory, KG, Forecast, Decision, Rec |
| Workflow Engine used | ✅ Bootstrap workflows registered |
| Marketplace SDK path | ✅ Adapters feed conversations (existing) |
| New marketplace readiness | ✅ Channel-agnostic inbox model |

### UI completeness

| Module | UI Route | API |
| --- | --- | --- |
| Unified Inbox | `/chats` | ✅ |
| Customer 360 | `/customers` | ✅ |
| Deal Pipeline | `/deals` | ✅ |
| Budget Center | `/budget` | ✅ |
| Regional Center | `/analytics/regional` | ✅ |
| Automation Studio | `/automations` | ✅ React Flow |
| Task Center | `/tasks` | ✅ |
| Activity Timeline | `/history` | ✅ |
| Command Palette | ⌘K | ✅ Search |
| Listing/Media/Calendar | scaffold | partial API |

### Production readiness gaps

| Gap | Severity |
| --- | --- |
| Real channel adapters (Telegram, WA) | High — plug via SDK |
| Media job → real AI pipeline | Medium |
| WebSocket notifications | Medium |
| Calendar UI page | Low — API ready |
| Light theme toggle | Low |

### Improvements in 0.4

1. Commerce event catalog (20+ events)
2. Conversation, Customer, Deal aggregates + projections
3. Commerce platform engines (Job, Task, Notification, Search, Timeline)
4. AI Sales Agent with audit logging
5. `/api/commerce/*` unified API
6. Premium UI for core commerce flows
7. Workflow bootstrap (auto-task, deal-ai-stage)
8. Full documentation suite

---

## ADR-014: AI Platform as extension layer (Release 0.5)

**Status:** Accepted

**Context:** Release 0.4 Commerce Platform added AI Sales Agent with direct intelligence DI. Need a unified AI pipeline (Gateway → Orchestrator → Learning) without duplicating Stage 3 engines or forking CRM patterns.

**Decision:** Release 0.5 adds AI Platform under `apps/api/src/platform/ai-platform/` as a global Nest module. All AI tasks enter via `AiGatewayService`; `SalesAgentService` and `/api/ai/*` delegate to Gateway. Intelligence (Forecast, Decision, KG, Memory v1) consumed by `ReasoningEngine` only. AI facts append to `ai` event stream (`packages/contracts/src/events/ai-catalog.ts`).

**Consequences:**
- (+) Single entry point, cost tracking, and observability for every AI run
- (+) Tool Registry v2 + plugin-style runtime — MCP-ready catalog layer
- (+) Agent/Skill/Prompt registries tenant-scoped outside code
- (-) Multi-step agent loops and LLM-as-judge evaluation deferred
- (-) Some Tool Registry v2 entries metadata-only until executors wired

---

## Release 0.5 audit (final)

### Event Sourcing / CQRS compliance

| Check | Result |
| --- | --- |
| AI run lifecycle events (`ai.run_*`, `ai.tool_invoked`, …) | ✅ Event catalog + publisher |
| Read models for runs, plans, evals, learning | ✅ Prisma read models |
| Command/query separation | ✅ Writes via Gateway/Orchestrator; reads via `/api/ai/*` |
| Commerce aggregates unchanged | ✅ Sales agent delegates, no fork |

### Logic duplication check

| Area | Single source |
| --- | --- |
| Forecast / metrics / decisions in AI context | ✅ `ReasoningEngine` → Stage 3 engines |
| Tool execution | ✅ `AiToolRegistry` + `ToolRuntimeService` |
| Memory | ✅ `MemoryV2Service` wraps `AiMemoryEngine` |
| Cost formula | ✅ Router estimate in Orchestrator only |

### Scalability

| Area | Readiness |
| --- | --- |
| Gateway rate limit (10k runs/day/tenant) | ✅ |
| Stateless orchestrator per request | ✅ |
| Event stream `ai` partitionable by tenant | ✅ Ready |
| OpenRouter externalized | ✅ Provider swap via env + tenant `aiSettings` |

### Cost governance

| Check | Result |
| --- | --- |
| Per-run `costUsd` + `ai.cost_recorded` | ✅ |
| Tenant cost summary (`AiCostService`) | ✅ |
| Evaluation `costEfficiency` metric | ✅ |
| Hard budget caps | ⚠️ Future — link to Budget Center |

### DDD boundaries

| Layer | Boundary |
| --- | --- |
| AI Platform | Extension — no new commerce aggregates |
| Agents / Prompts / Tools | Configuration read models |
| Intelligence | Unchanged domain — consumed, not copied |
| Commerce agent | Application service → Gateway |

### Plugin runtime / MCP readiness

| Check | Result |
| --- | --- |
| Tools registered at bootstrap | ✅ `AiPlatformBootstrapService` |
| Tool Registry v2 metadata (permissions, cost, deps) | ✅ |
| MCP adapter | ⚠️ Catalog ready; HTTP MCP server not shipped in 0.5 |
| Marketplace SDK tools | ✅ `marketplace.search` in catalog |

### UI / API completeness

| Module | UI Route | API |
| --- | --- | --- |
| AI Studio | `/ai/studio` | ✅ agents, skills |
| Cost Center | `/ai/cost` | ✅ |
| Generator / Assistant / Analytics / Media | `/ai/*` | ✅ run + dashboard |
| Commerce Sales Agent | inbox flows | ✅ `/api/commerce/agent/*` → Gateway |
| Learning / Observability / Benchmark | API-first | ✅ |

### Production readiness gaps

| Gap | Severity |
| --- | --- |
| LLM-as-judge evaluation | Medium |
| Auto prompt/router optimization | Medium |
| MCP server endpoint | Medium |
| Multi-agent supervisor loops | Low |
| Benchmark → router auto-bind | Low |

### Improvements in 0.5

1. AI Platform module (Gateway, Orchestrator, Router, Planner, Reasoning)
2. Memory v2 multi-tier + v1 bridge
3. Tool Runtime + Tool Registry v2
4. Prompt / Agent / Skill registries
5. Evaluation → Learning → Optimization pipeline
6. AI Cost Center + Benchmark service
7. AI Observability (spans + audit)
8. AI event catalog (12 event types)
9. `/api/ai/*` unified API + web AI routes
10. SalesAgentService → AiGatewayService delegation
11. Full AI Platform documentation suite

---

## ADR-015: Avito Enterprise as marketplace-specific layer (Release 0.6)

**Status:** Accepted

**Context:** Releases 0.4–0.5 established Commerce and AI Platform as extension layers. Avito operations (multi-account sync, listing generator, regional drafts, KB RAG, Avito analytics) need a dedicated surface without branching core or duplicating Intelligence/Commerce/AI logic.

**Decision:** Release 0.6 adds Avito Enterprise Platform under `apps/api/src/platform/avito/` as a global Nest module (`AvitoPlatformModule`). Unified API at `/api/avito/*` via `AvitoController`. Avito facts append to `avito` event stream (`packages/contracts/src/events/avito-catalog.ts`). REST integration remains in `AvitoMarketplacePlugin`; platform services orchestrate Commerce, AI Gateway, and Stage 3 engines via DI.

**Consequences:**
- (+) Marketplace-specific UX and workflows without polluting core
- (+) Honest capability matrix — messaging/stats supported; publication/autoload deferred
- (+) Reuses Commerce inbox/agent/budget, AI Gateway, Forecast/Recommendation/Regional Intel
- (-) Regional publishing and listing drafts are local until Autoload module ships
- (-) External notification channels (Telegram, email) stub-only in 0.6

---

## Release 0.6 audit (final)

### Official Avito API capability alignment

| Capability | Plugin status | Platform behavior |
| --- | --- | --- |
| messaging | ✅ supported | Messenger API via SDK; inbox unified in Commerce |
| statistics | ✅ supported | `pullAvitoStats` → plugin statistics module |
| webhooks / health / identity / account | ✅ supported | Plugin modules registered |
| publication | ❌ deferred | Local ad drafts; `RegionalPublishingService` draft mode |
| promotion | ❌ deferred | No REST integration |
| sync (full catalog) | ❌ deferred | Sync orchestrator returns `limited` + projection fallback |

### Architecture compliance

| Check | Result |
| --- | --- |
| Event Sourcing for Avito facts | ✅ `avito.*` catalog (16 event types) |
| CQRS read/write split | ✅ Writes via platform services; reads via `/api/avito/*` |
| Marketplace SDK path | ✅ No Avito branching in core controllers |
| Plugin capability honesty | ✅ `publication: false`, `sync: false` in manifest |

### Logic duplication check

| Area | Single source |
| --- | --- |
| ROI / ROAS / budget summary | ✅ `BudgetCenterService` + `MetricsEngine` |
| Forecast / recommendations in analytics | ✅ `ForecastEngine`, `RecommendationEngine` |
| Regional rankings | ✅ `RegionalIntelligenceEngine` |
| AI listing / chat | ✅ `AiGatewayService` only |
| Inbox / conversations | ✅ `ConversationService` (Commerce) |
| Workflow automations | ✅ `WorkflowEngine` — Avito runtime registers triggers |

### Integration with Stages 0.1–0.5

| Stage / Release | Integration |
| --- | --- |
| 0.1 Event Store | `avito` stream + existing ad/conversation streams |
| 0.2 Marketplace SDK | `AvitoMarketplacePlugin` capabilities |
| 0.3 Intelligence | Forecast, Recommendation, Regional Intel, AI Memory |
| 0.4 Commerce | Inbox, agent, budget, jobs, notifications, listing studio |
| 0.5 AI Platform | Listing Generator, Regional AI, Sales Agent via Gateway |

### Scalability and performance

| Area | Readiness |
| --- | --- |
| Listing pipeline (8 sequential AI steps) | ⚠️ Rate-limit via Gateway; batch queue recommended |
| Regional batch publish | ⚠️ O(regions × AI call); async job candidate |
| KB keyword retrieval | ✅ Indexed chunks; vector search future |
| `avito` event stream | ✅ Partitionable by tenant |
| Account sync | ✅ Per-account orchestration; no full-catalog scan |

### Credential security

| Check | Result |
| --- | --- |
| Avito OAuth client_credentials in env | ✅ `AVITO_CLIENT_ID` / `AVITO_CLIENT_SECRET` |
| Per-tenant account linkage | ✅ `AccountReadModel` + `AvitoAccountDetailReadModel` |
| Credential vault aggregate | ⚠️ Future — Stage 4 backlog (ADR known gap) |
| Webhook signature verify | ⚠️ `verifySignature` returns true — harden before production |

### AI pipeline correctness

| Check | Result |
| --- | --- |
| Listing Generator → Gateway → `ai.*` events | ✅ |
| Sales Agent RAG → KB → Gateway CHAT | ✅ |
| Confidence gating on auto-send | ✅ default 0.7 |
| Step context chaining in listing pipeline | ✅ prior output fed to next step |
| No direct OpenRouter bypass | ✅ Media pipeline only for image/text jobs |

### UI / API completeness

| Module | UI Route | API |
| --- | --- | --- |
| Account Center | `/avito/accounts` | ✅ |
| Analytics Center | `/avito/analytics` | ✅ |
| Listing Generator | `/avito/listing` | ✅ |
| Regional Publishing | `/avito/regional` | ✅ |
| Knowledge Base | `/avito/knowledge` | ✅ |
| Notifications | `/avito/notifications` | ✅ |
| Ads Manager / Agent / Budget | Commerce + Avito API | ✅ API-first |
| Automation Center | `/automations` | ✅ via Commerce + runtime |
| Dashboard | Account Center | ✅ `GET /avito/dashboard` |

### Production readiness gaps

| Gap | Severity |
| --- | --- |
| Avito Autoload / publication API | High — separate module |
| Full catalog sync | High — deferred capability |
| External notification adapters (real Telegram/email) | Medium |
| KB vector embeddings | Medium |
| Webhook signature verification | Medium |
| Per-tenant credential vault | High — Stage 4 |

### Features requiring separate implementation for Ozon / WB / Yandex Market

Each marketplace needs its own plugin + platform layer (or generalized marketplace platform). Not covered by Avito 0.6:

1. **Marketplace-specific listing generator prompts** — category/field rules per platform
2. **Regional / warehouse publishing** — Ozon FBS/FBO, WB offices, YM delivery regions
3. **Platform statistics API mapping** — different metrics schemas and auth
4. **Publication / catalog sync** — each platform's listing API or feed format
5. **Promotion / bidding APIs** — platform-specific ad spend tools
6. **Messaging adapters** — Ozon Seller chat, WB buyer chat, YM order messages
7. **Webhook parsers** — platform-specific payload schemas
8. **Budget / billing import** — platform settlement and commission models
9. **Knowledge Base locale/rules** — marketplace policy documents per channel
10. **Automation trigger catalog** — platform-specific event types
11. **Account center limits** — rate limits, SKU caps, warehouse bindings
12. **Media requirements** — image dimensions, background rules, video specs

### Improvements in 0.6

1. Avito Platform module (14 services under `platform/avito/`)
2. Avito event catalog (16 event types)
3. `/api/avito/*` unified API + web `/avito/*` routes
4. Listing Generator 8-step AI pipeline
5. Regional Publishing draft batches
6. Knowledge Base upload + RAG for Sales Agent
7. Avito Analytics Center + stats sync orchestrator
8. Budget import extensions
9. Media pipeline + object storage
10. Multi-channel notification config + automation triggers
11. Account Center with sync history
12. Full Avito Enterprise documentation suite

---

## ADR-016: Professional Workspace as frontend experience layer (Release 0.7)

**Status:** Accepted

**Context:** Releases 0.1–0.6 delivered backend platform, Commerce, AI, and Avito Enterprise APIs. Daily Avito seller workflows still required a cohesive product surface comparable to Linear/Stripe — without new backend services or duplicated business logic.

**Decision:** Release 0.7 is a **frontend-only** experience layer in `apps/web/`:
- New workspace pages (Dashboard, Ads Workspace, Unified Inbox 3-column, Executive Mode)
- Persistent AI Copilot panel with page context (`CopilotProvider`, `/api/ai/run`)
- Command Center (⌘K) over existing global search + navigation + KB
- Lazy-loaded routes, virtual scrolling for ads, dark/light theme
- All data via existing `entities/*/api.ts` hooks — no new domain models

**Consequences:**
- (+) Single daily-work UI; Avito web UI optional for sellers
- (+) Zero backend duplication — UI consumes 0.1–0.6 APIs only
- (+) Copilot context travels with route/entity selection
- (-) Some visualizations (geo map, period compare) are projection-based until richer API aggregates ship
- (-) Mobile inbox 360 panel requires follow-up drawer layout

---

## Release 0.7 audit (final)

| Check | Result |
| --- | --- |
| UX per screen | ✅ Workspace layouts, copilot, command palette |
| Performance | ✅ Lazy routes, `@tanstack/react-virtual`, query staleTime |
| Accessibility | ⚠️ cmdk dialog roles; axe audit recommended |
| Mobile adaptation | ⚠️ Inbox stacks; sidebar drawer TBD |
| Unified style | ✅ oklch tokens, light/dark, Framer Motion |
| Existing APIs only | ✅ No new backend in 0.7 |
| No logic duplication | ✅ Hooks only |
| Enterprise SaaS bar | ✅ Executive, Studio, Analytics tabs |
| UI/UX audit | ✅ See `docs/ux-professional-workspace.md` |

### Follow-up backlog (0.8+)

1. Mobile sidebar drawer + inbox Customer 360 sheet
2. MapLibre regional map with real geo boundaries
3. Sonner toasts for optimistic mutations
4. WebSocket/SSE inbox realtime when backend adds stream
5. `@dnd-kit` deals kanban polish
6. Period-over-period analytics API aggregate (backend read model)
