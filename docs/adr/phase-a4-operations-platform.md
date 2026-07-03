# ADR: Phase A4 — Avito Operations Platform

## Status

Accepted — 2026-07-03

## Context

После Phase A3 (Avito Live Sync) пользователям нужна полноценная CRM для ежедневной работы с объявлениями Avito внутри NEEKLO Marketplace OS.

Ограничения:

- Не менять OAuth, Vault, Event Store, CQRS, Commerce, AI Platform, Intelligence, Avito Live
- Только официальный Avito API — без эмуляции
- REST не поддерживает create/delete item — публикация через Autoload

## Decision

1. **Новый модуль `AvitoOperationsModule`** — orchestration поверх существующих сервисов (`AvitoAdsManagerService`, `MediaPipelineService`, `RegionalPublishingService`, `AiGatewayService`, `AvitoClient`, Live snapshots).

2. **Три read model** для enrichment, feed exports, timeline — без нового Event Store.

3. **Единый UI** `/avito/operations` с 10 разделами и 6 view modes (table, cards, gallery, compact, kanban, timeline).

4. **Feed export** — локальная генерация XML/CSV/JSON → Selectel S3 → ручная/Autoload загрузка.

5. **Bulk `sync_price_avito`** — единственный прямой write в Avito REST (`update_price`).

6. **Media Pro** — расширение `MediaPipelineService` (watermark, resize, banner, …) с честным ограничением для `AI_IMAGE_PROVIDER=stub`.

## Consequences

- Локальные правки title/description не попадают на Avito без feed export
- Promotion UI read-only до явного вызова VAS API с itemId + serviceId
- 100k ads требует cursor pagination (реализовано, UI limit 200 по умолчанию)

## Alternatives rejected

- Новый Marketplace SDK layer — запрещено
- Эмуляция Avito item CRUD — запрещено
- Отдельный Event Store для operations — запрещено
