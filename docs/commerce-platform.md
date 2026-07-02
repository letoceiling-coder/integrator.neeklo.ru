# Commerce Platform — Release 0.4

NEEKLO Commerce Platform is the operational layer for marketplace sales — unified inbox, customer profiles, deal pipeline, listing/media studios, AI sales agent, and operational centers (budget, regions, tasks, calendar, notifications).

## Architecture

```mermaid
flowchart TB
  subgraph UI["React 19 Web"]
    INBOX[Unified Inbox]
    C360[Customer 360]
    DEALS[Deal Pipeline]
    STUDIO[Listing / Media Studio]
    AUTO[Automation Studio]
  end

  subgraph API["/api/commerce/*"]
    CTRL[CommerceController]
  end

  subgraph Domain["Event-Sourced Aggregates"]
    CONV[Conversation]
    CUST[Customer]
    DEAL[Deal]
  end

  subgraph Platform["Commerce Platform"]
    AGENT[AI Sales Agent]
    JOB[Job Engine]
    TASK[Task Engine]
    NOTIF[Notification Engine]
    SEARCH[Search Engine]
    TIMELINE[Timeline Engine]
  end

  subgraph Intelligence["Stage 3 — reused"]
    MEM[AI Memory]
    KG[Knowledge Graph v2]
    FC[Forecast Engine]
    DEC[Decision Engine]
    REC[Recommendation Engine]
  end

  UI --> API
  CTRL --> Domain
  CTRL --> Platform
  AGENT --> Intelligence
  Domain --> ES[(Event Store)]
  ES --> PROJ[Projections]
```

## Modules

| Module | API | Aggregate |
| --- | --- | --- |
| Unified Inbox | `GET/POST /commerce/inbox*` | `conversation` |
| Customer 360 | `GET/POST /commerce/customers*` | `customer` |
| Deal Pipeline | `GET/POST /commerce/deals*` | `deal` |
| Listing Studio | `GET /commerce/listings/:id/studio` | `ad` (existing) |
| Media Studio | `POST /commerce/media/jobs` | `commerce` stream |
| AI Sales Agent | `POST /commerce/agent/*` | — |
| Budget Center | `GET /commerce/budget` | Metrics Warehouse |
| Regional Center | `GET /commerce/regions` | Regional Intelligence |
| Automation Studio | `GET/POST /commerce/automations` | Workflow Engine |
| Notification Center | `GET /commerce/notifications` | read model |
| Activity Timeline | `GET /commerce/timeline` | Event Store |
| Task Center | `GET /commerce/tasks` | read model |
| Search Everywhere | `GET /commerce/search` | SearchIndex |

## Design principles

- **No CRM reimplementation** — operational OS for marketplace sales
- **Platform-agnostic inbox** — channel hidden in UI, unified thread UX
- **All mutations → Event Store** — conversations, customers, deals
- **Intelligence reuse** — no duplicate metrics/forecast/decision logic
- **Workflow Engine** — automations registered at bootstrap

See also: [unified-inbox.md](./unified-inbox.md), [customer-360.md](./customer-360.md), [deal-pipeline.md](./deal-pipeline.md)
