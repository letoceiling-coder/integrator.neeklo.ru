# Dogfooding Protocol — 30 дней до Release 1.0

## Правило

**Работать только через Marketplace OS.**  
Кабинет Avito — **запрещён**, если действие заявлено или логически поддерживается системой.

Если без Avito не обойтись → **BUG** или **FEATURE REQUEST** → запись в [Production Backlog](./backlog/PRODUCTION_BACKLOG.md).

Новый функционал и изменения архитектуры **не пишем** в период dogfooding. Только фиксируем и предлагаем **минимальные** RC-совместимые исправления.

---

## Ежедневный цикл

1. **Утро** — `/avito/production` → Readiness + Monitor; `/avito/automation` → утренний отчёт.
2. **Продажи** — Inbox, Sales Center, CRM (лиды, pipeline, ответы).
3. **Операции** — объявления, bulk, feed, media (Operations Center).
4. **Вечер** — Analytics, Automation Observatory, Executive AI.

При любом отходе в Avito — сразу создать запись в backlog (шаблон ниже).

---

## Карта «где делать в OS» (не открывать Avito)

| Задача | Маршрут в Marketplace OS |
|--------|--------------------------|
| Подключить аккаунт | `/settings/oauth`, `/avito/accounts` |
| Проверить OAuth / scopes | `/settings/oauth`, `/avito/production` → Permissions |
| Sync объявлений / messenger | `/avito/live` → Sync |
| Webhook | `/avito/live` → Webhook Center |
| Inbox / ответ клиенту | `/chats` или `/avito/sales` → Smart Inbox |
| Лиды / pipeline | `/avito/sales` |
| Bulk цена / операции | `/avito/operations` |
| Feed export / validate | `/avito/operations` → Feed, `/avito/production` → Feed |
| Аналитика | `/avito/analytics`, `/ai/analytics` |
| AI рекомендации | `/avito/automation` |
| Уведомления | `/avito/notifications` |
| Production health | `/avito/production` |
| Backup конфигов | `/avito/production` → Backup |

---

## Когда Avito всё же нужен (ожидаемые FEATURE, не баг)

Документированные ограничения RC — не нарушение протокола, но **фиксируем** если мешает работе:

- Регистрация OAuth app / redirect URI в Developer Portal
- Первичная настройка Autoload profile в кабинете Avito
- Подписка на webhook URL в кабинете (если не автоматизировано)
- Оплата услуг / пополнение баланса Avito
- Публикация объявлений без Autoload (REST create item недоступен)

---

## Шаблон записи backlog

Файл: `docs/backlog/BL-XXX-slug.md` или строка в [PRODUCTION_BACKLOG.md](./backlog/PRODUCTION_BACKLOG.md).

```markdown
## BL-XXX: [Краткое название]

- **Тип:** BUG | FEATURE REQUEST
- **Категория:** UX | Performance | Sync | OAuth | Messenger | Feed | AI | CRM | Analytics | Automation | Notifications | Media | Operations
- **Приоритет:** P0 | P1 | P2 | P3
- **Дата:** YYYY-MM-DD
- **День dogfooding:** N/30

### Описание
Что произошло и почему пришлось (или захотелось) открыть Avito.

### Шаги воспроизведения
1. ...
2. ...

### Ожидание
Что должна была сделать Marketplace OS.

### Предлагаемое решение (минимальное, RC-compatible)
Конкретный маленький diff — без новых модулей.

### Связанные сервисы
- `AvitoMessengerOutboundService`, `ConversationService`, ...

### Статус
open | triaged | scheduled-r1.0 | wontfix
```

---

## Приоритеты

| Уровень | Критерий |
|---------|----------|
| **P0** | Блокер продаж: нельзя ответить клиенту, sync мёртв, OAuth сломан |
| **P1** | Ежедневная работа с обходом через Avito |
| **P2** | Неудобство, есть workaround в OS |
| **P3** | Полировка UX / nice-to-have |

---

## После 30 дней

1. Свести все `BL-*` в [Production Backlog](./backlog/PRODUCTION_BACKLOG.md).
2. Отсортировать: P0 → P3, сгруппировать по категории.
3. Оценить effort (S/M/L) — только для R1.0, не для RC.
4. **Release 1.0** начинается только после утверждения backlog — не раньше.

---

## Связанные документы

- [release-candidate.md](./release-candidate.md)
- [production-readiness.md](./production-readiness.md)
- [testing.md](./testing.md)
