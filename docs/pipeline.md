# Pipeline

API: `GET /api/avito/sales/pipeline`, `PUT /api/avito/sales/pipeline/move`

## Stages

Новый → В работе → Ожидает → Переговоры → КП → Бронь → Продажа → Повторная → Закрыт

Mapped to `DealService.changeStage` via `AVITO_PIPELINE_TO_DEAL`.

UI: Kanban with @dnd-kit drag & drop.
