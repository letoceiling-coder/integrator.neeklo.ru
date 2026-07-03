# Regional Studio

API: `GET /api/avito/operations/regional/drafts`  
Create: `POST /api/avito/regional/publish` (existing)

## Status per city

| Status | Meaning |
| --- | --- |
| draft | Local `RegionalDraftReadModel` |
| ready | Ready for feed export |
| exported | Included in feed export |
| error | Validation failed |

**No direct Avito publish** — export via Feed Studio.
