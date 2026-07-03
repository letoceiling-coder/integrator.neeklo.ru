# Content Intelligence

API: `GET /api/avito/automation/content`, `POST /api/avito/automation/content/analyze/:adId`

AI analyzes listing:

- Photo quality
- Title & description
- SEO & keywords
- Overall listing quality score

Uses `AdReadModel`, `AvitoAdEnrichmentReadModel`, and `AiGatewayService`.

Suggestions stored in `AvitoContentRecommendationReadModel` — no auto-edits.
