# Testing

Run: `cd apps/api && pnpm test`

## E2E scenario map

`test/production-flow.e2e.spec.ts` documents the full journey:

OAuth → Token → Sync → Ads → Messages → Lead → Pipeline → AI Draft → Reply → Timeline → Analytics → Automation → Executive Dashboard

## Live tests

`POST /api/avito/production/test/:component?accountId=`  
Components: `oauth`, `webhook`, `feed`, `messenger`, `ai`

## Sandbox mode

Default `sandbox` — Messenger send persists locally only. Switch to `production` for real Avito API send.
