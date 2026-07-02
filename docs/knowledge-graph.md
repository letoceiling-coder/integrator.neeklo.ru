# Knowledge Graph

Internal graph linking all platform entities for AI context assembly.

## Node kinds

`organization`, `user`, `account`, `ad`, `customer`, `conversation`, `message`, `region`, `competitor`, `budget`, `media`, `campaign`, `event`, `recommendation`, `marketplace`

## Edge relations

`owns`, `manages`, `published_on`, `connected_to`, `messaged_in`, `competes_with`, `spent_from`, `located_in`, `triggered`, `recommends`, `caused_by`

## Schema

```mermaid
erDiagram
  KnowledgeNode ||--o{ KnowledgeEdge : from
  KnowledgeNode ||--o{ KnowledgeEdge : to
  KnowledgeNode {
    uuid id
    uuid tenantId
    string kind
    string entityId
    string label
    json properties
  }
  KnowledgeEdge {
    uuid id
    uuid tenantId
    uuid fromNodeId
    uuid toNodeId
    string relation
    float weight
  }
```

## Ingestion

`KnowledgeGraphService.ingestEvent()` runs on every event in Analytics Engine:

- Creates event node + links to aggregate
- `ad.created` → links to marketplace + region
- `account.created` → links to organization

## AI usage

`GET /api/marketplace/knowledge/:kind/:entityId` returns related nodes/edges.

AI Assistant receives **graph context**, not raw event streams.

## Query

`getContext(tenantId, kind, entityId, depth)` — returns neighborhood for prompt assembly.
