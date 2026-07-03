# Lead Center

API: `GET /api/avito/sales/leads`

Каждое входящее сообщение Avito (webhook или messenger sync) создаёт/обновляет лид через `AvitoCrmBridgeService`.

## Lead card fields

Имя, телефон, accountId, adId, source, city/region, pipelineStage, assignee, aiScore, purchaseProbability, forecast, lastActivityAt, conversationId, dealId.

Auto follow-up rules seeded on new lead (1/3/7/30 days).
