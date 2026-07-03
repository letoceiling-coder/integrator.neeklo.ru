# Production Backlog

> Период dogfooding: **30 дней** · Старт: _заполнить при первом дне_ · Финал: _+30 дней_  
> Правила: [dogfooding-protocol.md](../dogfooding-protocol.md)

## Сводка (обновлять еженедельно)

| Категория | Open | P0 | P1 | P2 | P3 |
|-----------|------|----|----|----|-----|
| UX | 0 | 0 | 0 | 0 | 0 |
| Performance | 0 | 0 | 0 | 0 | 0 |
| Sync | 0 | 0 | 0 | 0 | 0 |
| OAuth | 0 | 0 | 0 | 0 | 0 |
| Messenger | 0 | 0 | 0 | 0 | 0 |
| Feed | 0 | 0 | 0 | 0 | 0 |
| AI | 0 | 0 | 0 | 0 | 0 |
| CRM | 0 | 0 | 0 | 0 | 0 |
| Analytics | 0 | 0 | 0 | 0 | 0 |
| Automation | 0 | 0 | 0 | 0 | 0 |
| Notifications | 0 | 0 | 0 | 0 | 0 |
| Media | 0 | 0 | 0 | 0 | 0 |
| Operations | 0 | 0 | 0 | 0 | 0 |
| **Итого** | **0** | **0** | **0** | **0** | **0** |

---

## Seed items (известные ограничения RC — triage при dogfooding)

Эти пункты **не блокируют старт** dogfooding; при подтверждении в реальной работе повысить приоритет.

### BL-001: Sandbox по умолчанию блокирует отправку в Avito Messenger

- **Тип:** FEATURE REQUEST (ожидаемое поведение, но легко забыть)
- **Категория:** Messenger
- **Приоритет:** P1
- **Статус:** open (seed)

**Описание:** В режиме `sandbox` сообщения сохраняются локально, Avito API не вызывается. Пользователь может не заметить и думать, что клиент получил ответ.

**Шаги:** Smart Inbox → Send → Production Readiness показывает sandbox.

**Решение (минимальное):** Banner в Inbox/Sales при `mode=sandbox`; CTA «Switch to Production» → `/avito/production`.

**Сервисы:** `ProductionSandboxService`, `AvitoMessengerOutboundService`, `/chats`, `/avito/sales`

---

### BL-002: Feed export без upload в Avito Autoload

- **Тип:** FEATURE REQUEST
- **Категория:** Feed
- **Приоритет:** P1
- **Статус:** open (seed)

**Описание:** Feed генерируется и кладётся в S3, но `POST /autoload/v4/uploads` не вызывается — для публикации нужен ручной upload или кабинет Avito.

**Шаги:** Operations → Feed Studio → Export → файл готов, объявления в Avito не обновились.

**Решение (минимальное):** Опциональный шаг «Upload to Autoload» в `ProductionFeedService` с явным confirm; ошибки тарифа — user-facing message.

**Сервисы:** `AvitoOperationsFeedService`, `ProductionFeedService`, `AvitoClient`

---

### BL-003: Webhook signature verify — stub

- **Тип:** BUG (security)
- **Категория:** OAuth
- **Приоритет:** P2
- **Статус:** open (seed)

**Описание:** `AvitoWebhooks.verifySignature()` возвращает `true` без проверки.

**Решение (минимальное):** HMAC verify в plugin + reject в controller при fail.

**Сервисы:** `avito-marketplace.plugin.ts`, `AvitoWebhookController`

---

### BL-004: Два Inbox (Commerce vs Sales Center)

- **Тип:** UX
- **Категория:** CRM
- **Приоритет:** P2
- **Статус:** open (seed)

**Описание:** `/chats` и `/avito/sales` Smart Inbox — разный UX; outbound Avito wired только через commerce send path.

**Решение (минимальное):** Sales Inbox send вызывает тот же outbound service; или redirect hint с `/chats`.

**Сервисы:** `CommerceController`, `AvitoSmartInboxService`, `AvitoMessengerOutboundService`

---

## Новые записи (добавлять ниже по мере dogfooding)

<!-- Формат:
### BL-005: Название
- **Тип:** ...
- **Категория:** ...
- **Приоритет:** ...
- **День:** N/30
...
-->

_Пока пусто — первая запись появится в День 1._

---

## Release 1.0 — черновик scope (заполнить после Дня 30)

_Не редактировать до завершения dogfooding._

### Must (P0–P1)

- [ ] ...

### Should (P2)

- [ ] ...

### Could (P3)

- [ ] ...

### Explicitly out of scope for R1.0

- [ ] ...

---

## Weekly log

| Неделя | Даты | Записей добавлено | Открыто Avito (раз) | Комментарий |
|--------|------|-------------------|---------------------|-------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
