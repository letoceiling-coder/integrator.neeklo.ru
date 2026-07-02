# Deal Pipeline

Kanban-style deal flow with AI stage suggestions from Decision Engine.

## Stages

Lead → Interested → Negotiation → Offer → Reserved → Paid → Completed | Cancelled

## Events

`deal.created`, `deal.stage_changed`, `deal.offer_made`, `deal.paid`, `deal.completed`, `deal.ai_stage_suggested`, `deal.won`, `deal.lost`

## API

- `GET /api/commerce/deals` — grouped by stage
- `POST /api/commerce/deals`
- `PUT /api/commerce/deals/:id/stage`
- `POST /api/commerce/deals/:id/apply-ai`

## Workflow

On `ad.contact_recorded`, workflow `deal-ai-stage` suggests stage from intelligence decisions.
