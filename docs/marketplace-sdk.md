# Marketplace SDK

`@neeklo/marketplace-sdk` defines the **only** contract between NEEKLO core and marketplace integrations.

## Design principle

> Core code resolves capabilities by name. It never branches on `marketplaceCode`.

## Root interface

```typescript
interface MarketplaceProvider {
  readonly manifest: MarketplaceProviderManifest;
  getCapabilityDescriptors(): CapabilityDescriptor[];
  resolve<K extends CapabilityName>(name: K): CapabilityModules[K] | null;
  supports(name: CapabilityName): boolean;
}
```

## Capability modules (30 interfaces)

| Capability | Interface | Purpose |
| --- | --- | --- |
| identity | `MarketplaceIdentity` | OAuth, token refresh, validation |
| account | `MarketplaceAccount` | Account info, limits |
| capabilities | `MarketplaceCapabilities` | Runtime capability queries |
| media | `MarketplaceMedia` | Upload/delete media |
| messaging | `MarketplaceMessaging` | Send/list conversations |
| analytics | `MarketplaceAnalytics` | Provider-side analytics |
| orders | `MarketplaceOrders` | Order list/get |
| notifications | `MarketplaceNotifications` | Webhook subscriptions |
| promotion | `MarketplacePromotion` | VIP/XL/Premium equivalents |
| publication | `MarketplacePublication` | Publish/update/archive |
| statistics | `MarketplaceStatistics` | Ad/account stats |
| search | `MarketplaceSearch` | Search listings |
| catalog | `MarketplaceCatalog` | Product catalog |
| files | `MarketplaceFiles` | File storage on marketplace |
| moderation | `MarketplaceModeration` | Review status |
| webhooks | `MarketplaceWebhooks` | Parse/verify webhooks |
| pricing | `MarketplacePricing` | Price recommendations |
| regions | `MarketplaceRegions` | Region tree |
| categories | `MarketplaceCategories` | Category tree |
| attributes | `MarketplaceAttributes` | Category attributes |
| ai | `MarketplaceAI` | Provider-native AI |
| competitors | `MarketplaceCompetitors` | Competitor tracking |
| budget | `MarketplaceBudget` | Spend limits |
| automation | `MarketplaceAutomation` | Provider automations |
| reports | `MarketplaceReports` | Provider reports |
| health | `MarketplaceHealth` | Health checks |
| sync | `MarketplaceSync` | Pull/push/reconcile |
| scheduler | `MarketplaceScheduler` | Scheduled tasks |
| telemetry | `MarketplaceTelemetry` | Provider telemetry |

## Context object

Every SDK method receives `MarketplaceContext`:

```typescript
interface MarketplaceContext {
  organizationId: string;
  accountId: string;
  marketplaceCode: MarketplaceCode;
  correlationId: string;
}
```

## Implementing a new marketplace

1. Extend `BaseMarketplaceProvider`
2. Register capability modules in constructor
3. Declare supported capabilities in manifest
4. Wrap as `NeekloPlugin` (kind: `marketplace`)
5. Register bootstrap in `PluginBootstrapService`

No changes to core services required.

## Avito reference implementation

`apps/api/src/plugins/avito/avito-marketplace.plugin.ts`

Supported today: identity, account, messaging, statistics, webhooks, health.

Publication/promotion/sync: declared unsupported (Autoload pipeline — separate module).
