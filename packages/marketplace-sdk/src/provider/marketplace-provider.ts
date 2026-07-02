import type {
  MarketplaceAccount,
  MarketplaceAI,
  MarketplaceAnalytics,
  MarketplaceAttributes,
  MarketplaceAutomation,
  MarketplaceBudget,
  MarketplaceCapabilities,
  MarketplaceCatalog,
  MarketplaceCategories,
  MarketplaceCompetitors,
  MarketplaceFiles,
  MarketplaceHealth,
  MarketplaceIdentity,
  MarketplaceMedia,
  MarketplaceMessaging,
  MarketplaceModeration,
  MarketplaceNotifications,
  MarketplaceOrders,
  MarketplacePricing,
  MarketplacePromotion,
  MarketplacePublication,
  MarketplaceRegions,
  MarketplaceReports,
  MarketplaceScheduler,
  MarketplaceSearch,
  MarketplaceStatistics,
  MarketplaceSync,
  MarketplaceTelemetry,
  MarketplaceWebhooks,
} from '../capabilities';
import type { CapabilityDescriptor, CapabilityName } from '../types/common';
import type { MarketplaceProviderManifest } from './manifest';

/** Typed map of all marketplace capability modules. */
export interface MarketplaceCapabilityModules {
  identity?: MarketplaceIdentity;
  account?: MarketplaceAccount;
  capabilities?: MarketplaceCapabilities;
  media?: MarketplaceMedia;
  messaging?: MarketplaceMessaging;
  analytics?: MarketplaceAnalytics;
  orders?: MarketplaceOrders;
  notifications?: MarketplaceNotifications;
  promotion?: MarketplacePromotion;
  publication?: MarketplacePublication;
  statistics?: MarketplaceStatistics;
  search?: MarketplaceSearch;
  catalog?: MarketplaceCatalog;
  files?: MarketplaceFiles;
  moderation?: MarketplaceModeration;
  webhooks?: MarketplaceWebhooks;
  pricing?: MarketplacePricing;
  regions?: MarketplaceRegions;
  categories?: MarketplaceCategories;
  attributes?: MarketplaceAttributes;
  ai?: MarketplaceAI;
  competitors?: MarketplaceCompetitors;
  budget?: MarketplaceBudget;
  automation?: MarketplaceAutomation;
  reports?: MarketplaceReports;
  health?: MarketplaceHealth;
  sync?: MarketplaceSync;
  scheduler?: MarketplaceScheduler;
  telemetry?: MarketplaceTelemetry;
}

/**
 * Root contract every marketplace plugin implements.
 *
 * Core code resolves capabilities through {@link resolve} — never `if (code === 'avito')`.
 * Unsupported capabilities return `null`; callers check the descriptor first.
 */
export interface MarketplaceProvider {
  readonly manifest: MarketplaceProviderManifest;

  /** Declared capability set (may differ from runtime availability per account). */
  getCapabilityDescriptors(): CapabilityDescriptor[];

  /** Resolve a capability module. Returns null when unsupported or not implemented. */
  resolve<K extends CapabilityName>(name: K): MarketplaceCapabilityModules[K] | null;

  /** Convenience: check descriptor support without resolving the module. */
  supports(name: CapabilityName): boolean;
}

/** Factory that constructs a provider instance (used by plugin runtime on activate). */
export interface MarketplaceProviderFactory {
  create(config: Record<string, unknown>): Promise<MarketplaceProvider> | MarketplaceProvider;
}
