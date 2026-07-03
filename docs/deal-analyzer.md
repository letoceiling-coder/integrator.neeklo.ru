# Deal Analyzer

API: `GET /api/avito/sales/deals/:id/analysis`

AI analyzes deal stage + conversation messages via `AiGatewayService`.

Output stored in `AvitoDealAnalysisReadModel`:

- outcome (won/lost/open)
- whyBought, whyLost
- improvements[]
- aiSummary
