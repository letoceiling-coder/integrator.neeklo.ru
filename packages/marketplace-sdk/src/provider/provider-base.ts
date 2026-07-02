import type { CapabilityDescriptor, CapabilityName } from '../types/common';
import type { MarketplaceCapabilityModules } from './marketplace-provider';
import type { MarketplaceProviderManifest } from './manifest';
import type { MarketplaceProvider } from './marketplace-provider';

/**
 * Base class for marketplace provider plugins. Subclasses register modules in the constructor;
 * {@link resolve} and {@link supports} are implemented once for all providers.
 */
export abstract class BaseMarketplaceProvider implements MarketplaceProvider {
  abstract readonly manifest: MarketplaceProviderManifest;
  protected readonly modules: Partial<MarketplaceCapabilityModules> = {};

  getCapabilityDescriptors(): CapabilityDescriptor[] {
    return this.manifest.capabilities;
  }

  supports(name: CapabilityName): boolean {
    return this.manifest.capabilities.some((c) => c.name === name && c.supported);
  }

  resolve<K extends CapabilityName>(name: K): MarketplaceCapabilityModules[K] | null {
    if (!this.supports(name)) return null;
    return (this.modules[name] as MarketplaceCapabilityModules[K]) ?? null;
  }

  protected registerModule<K extends keyof MarketplaceCapabilityModules>(
    name: K,
    module: NonNullable<MarketplaceCapabilityModules[K]>,
  ): void {
    this.modules[name] = module;
  }
}
