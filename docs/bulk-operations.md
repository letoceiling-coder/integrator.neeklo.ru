# Bulk Operations Center

API: `POST /api/avito/operations/bulk`

## Actions

| Action | Behavior |
| --- | --- |
| price_change | CQRS `AdsService.changePrice` |
| sync_price_avito | `POST /core/v1/items/{id}/update_price` |
| description_change | Enrichment read model |
| region_change / category_change | AdReadModel update |
| add_tags | Enrichment tags |
| prepare_feed | feedStatus = ready |
| export | JSON to S3 per ad |
| validate | Quality report |
| ai_rewrite / ai_optimize | AI Gateway |
| archive / copy / group | Existing Ads Manager |

Max 500 ads per request.
