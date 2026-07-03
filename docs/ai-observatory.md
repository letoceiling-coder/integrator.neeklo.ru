# AI Observatory

API: `GET /api/avito/automation/observatory`

Unified feed aggregating:

- Watcher findings (`AvitoObservatoryItemReadModel`)
- Pending decisions (`DecisionReadModel`)
- Open opportunities (`OpportunityReadModel`)

Dedup by `kind + entity + title` to avoid duplicate signals.

UI: `/avito/automation` → AI Observatory tab.
