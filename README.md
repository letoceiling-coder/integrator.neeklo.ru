# NEEKLO Marketplace OS

An **event-sourced, AI-native operating system** for selling on marketplaces. Avito is the first
adapter — the architecture is marketplace-agnostic from day one (Avito, Юла, Telegram, VK, Ozon,
Wildberries, Яндекс Маркет, Drom, Auto.ru, ЦИАН, …) behind a single **Marketplace Adapter Layer**.

> Not a CRM. Not an Avito panel. A full operating system for marketplace sales.

## Architecture pillars

| Pillar | Where |
| --- | --- |
| **Event Sourcing** (append-only, never delete history) | `packages/kernel` + `apps/api/src/platform/event-store` |
| **Event Bus** (Redis Streams + BullMQ, durable, replayable) | `apps/api/src/platform/event-bus` |
| **CQRS** (command/query buses, read-model projections) | `packages/kernel` + `apps/api/src/platform/cqrs` |
| **Domain Events** (`AdCreated`, `PriceChanged`, `ViewRecorded`, …) | `packages/contracts/src/events` |
| **Marketplace Adapter Layer** | `apps/api/src/platform/adapters` |
| **AI Tool Registry / Agent Engine seams** | `apps/api/src/platform/ai` |
| **Workflow Engine seam** | `apps/api/src/platform/workflow` |
| **Feature-Sliced Design frontend** | `apps/web/src/{app,pages,widgets,features,entities,shared}` |

## Monorepo layout

```
apps/
  api/        NestJS — event store, event bus, CQRS, domain modules, adapters, AI, auth
  web/        React 19 + Vite + Tailwind v4 + shadcn/ui + TanStack (Router/Query/Table)
packages/
  contracts/  Zod DTOs, the domain event catalog, marketplace enums (shared FE/BE)
  kernel/     Framework-agnostic building blocks: AggregateRoot, EventStore/EventBus ports, CQRS
docker/       Postgres + Redis for local dev
```

## Getting started

Prerequisites: **Node.js ≥ 22** (with `corepack`), **pnpm ≥ 9**, **Docker**.

```bash
corepack enable
cp .env.example .env          # fill in secrets

pnpm install
## Stage 2 — Marketplace Core Platform

See `docs/` for full architecture documentation:

- [architecture.md](./docs/architecture.md)
- [marketplace-sdk.md](./docs/marketplace-sdk.md)
- [plugin-runtime.md](./docs/plugin-runtime.md)
- [domain-model.md](./docs/domain-model.md)
- [decision-records.md](./docs/decision-records.md)

```bash
pnpm build:packages   # contracts + kernel + marketplace-sdk + plugin-runtime
pnpm db:migrate       # includes snapshots, knowledge graph, metrics tables
```
pnpm infra:up                 # start Postgres + Redis
pnpm db:generate              # generate Prisma client
pnpm db:migrate               # apply event-store + read-model schema
pnpm db:seed                  # seed owner + demo tenant + demo event streams
pnpm dev                      # api on :3001, web on :5173

# Demo login: owner@neeklo.dev / neeklo12345
```

## Design language

Minimal, expensive, calm. Inspired by Apple, Stripe, Notion, Linear, Vercel, Raycast, Arc, Framer,
OpenAI, Cursor. Maximum whitespace, minimum visual noise, fast and fluid.

## Non-negotiables

- No throwaway mocks, no `TODO`s left in shipped code.
- Every significant fact is stored as an **event** — history is never mutated or deleted.
- Every architecture targets ≥ 100k ads, ≥ 10k users, millions of messages, billions of analytics events.
