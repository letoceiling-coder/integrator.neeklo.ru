# Advertisement Studio

API: `GET/PUT /api/avito/operations/ads/:id/studio`  
AI: `POST /api/avito/operations/ads/:id/ai-rewrite`

## Layout

- **Left:** Media assets from `MediaAssetReadModel`
- **Center:** Title, description, price, category, region (local + CQRS price via `AdsService.changePrice`)
- **Right:** Validation, SEO score, analytics, AI suggestions

## Limitations

- Title/description — local until Feed export
- Avito REST update: price only (`update_price`)
