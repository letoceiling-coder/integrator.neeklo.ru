# Avito Sync Workers

Catalog: `apps/api/src/platform/avito-live/catalog/avito-official-endpoints.ts`

| Worker | Official API | Default interval | Notes |
| --- | --- | --- | --- |
| profile | GET /core/v1/accounts/self | 1h | Account profile |
| items | GET /core/v1/items | 5m | Paginated listings → AdReadModel |
| categories | GET /autoload/v1/user-docs/tree | 1d | Requires autoload scope |
| tariff | GET /tariff/info/1 | 1h | Tariff info |
| messenger | GET /messenger/v2/accounts/{user_id}/chats | 1m | Chats list |
| stats | POST /stats/v1/accounts/{user_id}/items | 15m | Needs item IDs |
| promotion | POST /promotion/v1/items/services/dict | 1h | Item context required |
| autoload | GET /autoload/v2/profile, uploads | 15m | Feed-based publishing |
| hierarchy | GET /checkAhUserV2, /getAhInfoV1 | 1h | Company keys only |
| phones | GET /listCompanyPhonesV1 | 1h | Company phones |
| employees | GET /listEmployeesV1 | 1h | If hierarchy available |
| ratings | GET /ratings/v1/accounts/{user_id} | 1h | Seller rating |
| reviews | GET /ratings/v1/accounts/{user_id}/reviews | 1h | Reviews list |
| stock | Stock API (OpenAPI) | 15m | If scope granted |
| call_tracking | Call tracking endpoints | 1h | If enabled on account |
| api_catalog | Local OpenAPI scan | 1d | Available operations |
| delivery | — | — | **unavailable** — no REST in bundle |
| jobs | — | — | **unavailable** — no REST in bundle |

## User-configurable intervals

30s, 1m, 5m, 15m, 1h, 1d via `PUT /api/avito/live/schedule`.

## Status values

`pending` | `running` | `completed` | `failed` | `unavailable` | `limited`
