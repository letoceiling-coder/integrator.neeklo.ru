# Avito Operations Platform (Phase A4)

Enterprise Operations Center поверх Release 0.1–0.7. Не изменяет OAuth, Vault, Event Store, CQRS, Commerce, AI, Intelligence, Avito Live.

## Маршрут

- UI: `/avito/operations`
- API: `/api/avito/operations/*`

## 10 разделов

| # | Раздел | API |
| --- | --- | --- |
| 1 | Ads Manager | `GET /avito/operations/ads` |
| 2 | Advertisement Studio | `GET/PUT /avito/operations/ads/:id/studio` |
| 3 | Media Studio Pro | `POST /avito/operations/media/jobs` |
| 4 | Bulk Operations | `POST /avito/operations/bulk` |
| 5 | Regional Studio | `GET /avito/operations/regional/drafts` |
| 6 | Feed Studio | `GET /avito/operations/feed`, `POST feed/export` |
| 7 | Promotion Center | `GET /avito/operations/promotion` |
| 8 | Operations Timeline | `GET /avito/operations/timeline` |
| 9 | Quality Center | `GET /avito/operations/ads/:id/quality` |
| 10 | Command Actions | ПКМ в Ads Manager → Studio |

## Read models (новые)

- `AvitoAdEnrichmentReadModel` — description, tags, feed/sync status, quality
- `AvitoFeedExportReadModel` — feed history, versioning
- `AvitoOperationsTimelineReadModel` — unified timeline

## Официальный Avito API

| Действие | API | Статус |
| --- | --- | --- |
| Sync цены | `POST /core/v1/items/{id}/update_price` | ✅ bulk `sync_price_avito` |
| VAS / Promotion | `PUT /core/v2/items/{itemId}/vas/` | Read dict via Live Sync |
| Публикация | Autoload Feed | Export XML/CSV/JSON |
| Create/delete item | — | ❌ не существует |

## Производительность

- Server-side pagination (`cursor`, `limit` до 500)
- TanStack Virtual (compact list)
- TanStack Table (table view)
- React Query cache + placeholderData

## Связанные документы

[ads-manager.md](./ads-manager.md) · [advertisement-studio.md](./advertisement-studio.md) · [media-studio-pro.md](./media-studio-pro.md) · [bulk-operations.md](./bulk-operations.md) · [regional-studio.md](./regional-studio.md) · [feed-studio.md](./feed-studio.md) · [promotion-center.md](./promotion-center.md) · [operations-timeline.md](./operations-timeline.md) · [quality-center.md](./quality-center.md)

## ADR

[adr/phase-a4-operations-platform.md](./adr/phase-a4-operations-platform.md)
