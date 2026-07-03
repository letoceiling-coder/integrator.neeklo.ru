# Deployment

## Prerequisites

- PostgreSQL + Redis  
- `OAUTH_VAULT_MASTER_KEY` (64 hex chars)  
- `AVITO_CLIENT_ID` / `AVITO_CLIENT_SECRET`  
- S3 (Selectel) for feeds/media  

## Commands

```bash
pnpm install
pnpm --filter @neeklo/contracts build
cd apps/api && pnpm exec prisma generate && pnpm exec prisma db push
pnpm --filter @neeklo/api build
pnpm --filter @neeklo/web build
```

## Environment

Copy `deploy/env.production.example`. Set `AVITO_BASE_URL=https://api.avito.ru` for production.

## Health

`GET /health` — DB + uptime  
`GET /api/avito/production/readiness?accountId=` — full checklist
