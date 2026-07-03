# Ads Manager (Operations Center)

UI: `/avito/operations` → **Ads Manager**  
API: `GET /api/avito/operations/ads`

## View modes

| Mode | Tech |
| --- | --- |
| table | TanStack Table |
| cards | Framer Motion grid |
| gallery | Photo grid |
| compact | TanStack Virtual (40px rows) |
| kanban | @dnd-kit/sortable by status |
| timeline | Sort by updatedAt |

## Ad fields

Enriched DTO merges `AdReadModel` + `AvitoAdEnrichmentReadModel` + Live sync worker status.

## Filters

Query params: `q`, `status`, `categoryId`, `regionId`, `cityId`, `priceMin`, `priceMax`, `promotion`, `autoload`, `aiScoreMin`, `contactsMin`, `ctrMin`, `tags`, `groupId`, `cursor`, `limit`.

## Command actions

Right-click row → Advertisement Studio.
