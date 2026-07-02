# Listing Studio

Ad editing workspace — history, linked chats, experiments, analytics (delegates to Intelligence Layer).

## API

`GET /api/commerce/listings/:adId/studio`

Returns: ad read model, listing history, related conversations, active experiments.

## Events

`listing.history_recorded`, `listing.bulk_updated` — audit trail for mass edits.

## Integration

- Metrics: `MetricsWarehouseEngine`
- Recommendations: `RecommendationEngine`
- Competitors: `CompetitorIntelligenceEngine`
- A/B: `ExperimentEngine`
