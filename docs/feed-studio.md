# Feed Studio

API: `GET /api/avito/operations/feed`, `POST /api/avito/operations/feed/export`

## Formats

- **XML** — Autoload-compatible `<Ads><Ad>…</Ad></Ads>`
- **CSV** — Id, Title, Price, Category, Region, City, Description
- **JSON** — Array of ad objects

## Features

- Versioning (`AvitoFeedExportReadModel.version`)
- History + S3 URL
- Queue stats (pending feed-ready ads)
- Autoload profile/uploads from Live snapshot

## Official Autoload

Upload to Avito: configure profile in Avito cabinet, then use `/autoload/v4/uploads` — not automated in this release (requires user Autoload setup).
