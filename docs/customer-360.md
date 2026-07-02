# Customer 360

Unified customer profile with AI score, interests, graph context, and linked conversations/deals.

## Aggregate

Stream: `customer:{id}` — `customer.created`, `customer.updated`, `customer.interest_recorded`

## API

- `GET /api/commerce/customers`
- `GET /api/commerce/customers/:id` — full 360 with KG + conversations + deals

## Read model fields

Contacts, interests, cities, preferences, aiScore, purchaseProbability, totalDeals, totalSpent, aiSummary.

Indexed in `SearchIndexEntry` for global search.
