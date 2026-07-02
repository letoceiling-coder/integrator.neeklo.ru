# Competitor Intelligence Engine

Dedicated service for **competitive landscape analysis** per ad.

## Tracked history

| Dimension | Detection |
| --- | --- |
| Price | Compare consecutive snapshots |
| Photos | SHA-256 hash change |
| Descriptions | Content hash change |
| Rank / position | Rank field delta |
| Appeared / disappeared | First/last observation |

## Insights

`analyze()` returns:

- **leaders** — rank === 1
- **dumpers** — price drop > 15%
- **insights** — per-competitor price trend, observation count

## Events

Each change emits `intelligence.competitor_change_detected`.

## Storage

Prisma model: `CompetitorSnapshot` — append-only observations keyed by `(tenantId, adId, competitorId, observedAt)`.

## API

`GET /api/intelligence/competition?adId={adId}`

## Usage from adapters

Marketplace plugins observe competitor listings via sync and call:

```typescript
competitorEngine.observe(tenantId, adId, { competitorId, title, priceAmount, photoHash, ... });
```

No Avito-specific logic in the engine — adapters supply observations.
