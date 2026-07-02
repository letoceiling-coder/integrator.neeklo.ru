# Regional Intelligence Engine

Analyzes marketplace performance **by region** and ranks regions by opportunity.

## Per-region metrics

| Field | Description |
| --- | --- |
| CTR, ROI | Aggregated from ads in region |
| avgPrice, avgViews, avgMessages | Mean across region ads |
| avgBudget, avgSaleTime | Spend and velocity |
| competition | supply / demand ratio |
| demand, supply | Derived from contacts/views and ad count |
| aiScore | Mean AI score |
| marketHealth | healthy / degraded / unhealthy |
| growth, decline | CTR-based signals |
| opportunityIndex | demand × ROI × 100 − competition penalty |
| rank | 1 = best opportunity |

## Ranking

`RegionalIntelligenceEngine.refresh()`:

1. Groups ads by `regionId`
2. Computes metrics per region
3. Sorts by `opportunityIndex` descending
4. Assigns ranks
5. Emits `intelligence.regional_ranking_updated` per region

## API

- `GET /api/intelligence/regions` — list ranked regions (auto-refresh)
- `GET /api/intelligence/regions/:regionId` — single region detail

## Integration

- **Opportunity Engine** consumes regional rankings for `high_conversion_region` and `low_competition` opportunities.
- **Decision Engine** uses `add_region` / `remove_region` actions when strategy is `region_expansion`.
