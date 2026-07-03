# Promotion Center

API: `GET /api/avito/operations/promotion?accountId=`

Data from `AvitoLiveSnapshotReadModel` domain `promotion` (sync worker).

## Shows

- Available services (official dict)
- AI recommendations (low CTR ads)
- Limitations for VAS apply API

## Apply promotion

Official: `PUT /core/v2/items/{itemId}/vas/` — requires itemId + service from dict. UI shows recommendations; apply flow is Phase follow-up when user selects service.
