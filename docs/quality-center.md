# Quality Center

API: `GET /api/avito/operations/ads/:id/quality`

## Scoring (0–100)

Deductions for: missing photo, short description, unknown category, validation errors.

## Reports

- Errors / missing fields
- Photo issues
- Description issues
- Keyword gaps (SEO)
- AI recommendations

Score persisted in `AvitoAdEnrichmentReadModel.qualityScore`.
