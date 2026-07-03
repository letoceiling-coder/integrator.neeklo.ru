# Marketplace Explorer

UI: `/avito/live` → **Explorer** tab  
API: `GET /api/avito/live/explorer?accountId=`

Tree structure:

```
Avito Account
├── Объявления (items)
├── Сообщения (messenger)
├── Отзывы (reviews)
├── Рейтинг (ratings)
├── Категории (categories)
├── Продвижение (promotion)
├── Автозагрузка (autoload)
├── Телефоны (phones)
├── Сотрудники (employees)
├── Иерархия (hierarchy)
├── Статистика (stats)
├── Call Tracking
└── Остатки (stock)
```

Each node shows:

- **count** — from snapshot `itemCount` or worker `sourceCount`
- **status** — worker `lastStatus`

Data source: read models only (no live Avito calls from UI).
