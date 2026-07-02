# Strategy Engine

Defines **business strategy profiles** that weight Decision Engine priorities.

## Strategy types

| Strategy | Priority |
| --- | --- |
| max_profit | Profit + ROI |
| max_sales | Sales volume + speed |
| min_budget | Budget conservation + ROI |
| max_roi | ROI-first |
| fast_sale | Speed + sales |
| retention | Engagement + retention |
| region_expansion | Geographic expansion |

## Weights

Each strategy maps to `StrategyWeights`:

```typescript
{ profit, sales, roi, budget, speed, retention, expansion }
```

Stored in `StrategyReadModel` per tenant.

## API

- `GET /api/intelligence/strategy`
- `POST /api/intelligence/strategy` — body `{ strategy: "max_roi" }`

## Decision integration

`DecisionEngine.decide()` calls `getActiveStrategy()` and passes weights to `scoreAction()` for each candidate action.

Default strategy when none configured: **max_roi**.
