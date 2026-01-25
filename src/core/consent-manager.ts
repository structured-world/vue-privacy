import type { ConsentConfig, StoredConsent, ConsentCategories } from "./types";
import { DEFAULT_CONFIG } from "./types";
import { getStoredConsent, storeConsent, clearConsent } from "./storage";
import {
  initGoogleAnalytics,
  updateConsent as updateGoogleConsent,
  categoriesToGoogleSignals,
} from "./gtag";
import { createGeoDetector } from "../geo/index";

/**
 * Consent Manager - orchestrates consent flow
 */
export class ConsentManager {
  private config: ConsentConfig;
  private initialized = false;
  private isEU: boolean | null = null;
  private showBannerCallback: (() => void) | null = null;
  private hideBannerCallback: (() => void) | null = null;

  constructor(config: ConsentConfig = {}) {
    this.config = {
      ...config,
      categories: { ...DEFAULT_CONFIG.categories, ...config.categories },
      banner: { ...DEFAULT_CONFIG.banner, ...config.banner },
      cookie: { ...DEFAULT_CONFIG.cookie, ...config.cookie },
    };
  }

  /**
   * Register callback to show banner
   */
  onShowBanner(callback: () => void): void {
    this.showBannerCallback = callback;
  }

  /**
   * Register callback to hide banner
   */
  onHideBanner(callback: () => void): void {
    this.hideBannerCallback = callback;
  }

  /**
   * Initialize consent manager
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Check for existing consent
    const stored = getStoredConsent(this.config);

    if (stored) {
      // User has already made a choice
      await this.applyConsent(stored.categories);
      return;
    }

    // Detect if user is in EU
    const detector =
      this.config.geoDetector ??
      createGeoDetector(this.config.euDetection ?? "auto");
    const geoResult = await detector.detect();
    this.isEU = geoResult.isEU;

    if (this.isEU) {
      // EU user: initialize GA with denied defaults, show banner
      if (this.config.gaId) {
        await initGoogleAnalytics(this.config.gaId, true);
      }

      // Show banner
      this.showBannerCallback?.();
      this.config.onBannerShow?.();
    } else {
      // Non-EU user: grant consent silently
      const grantedCategories = {
        analytics: true,
        marketing: this.config.categories?.marketing ?? false,
        functional: true,
      };

      await this.applyConsent(grantedCategories);
      storeConsent({ categories: grantedCategories }, this.config);
    }
  }

  /**
   * Apply consent settings
   */
  private async applyConsent(
    categories: Omit<ConsentCategories, "necessary">,
  ): Promise<void> {
    // Initialize GA if configured
    if (this.config.gaId) {
      await initGoogleAnalytics(this.config.gaId, !categories.analytics);
    }

    // Update Google Consent Mode
    const signals = categoriesToGoogleSignals(categories);
    updateGoogleConsent(signals);

    // Notify callback
    this.config.onConsentChange?.({
      categories,
      timestamp: Date.now(),
      version: this.config.version ?? DEFAULT_CONFIG.version,
    });
  }

  /**
   * Accept all cookies
   */
  async acceptAll(): Promise<void> {
    const categories = {
      analytics: true,
      marketing: true,
      functional: true,
    };

    await this.applyConsent(categories);
    storeConsent({ categories }, this.config);

    this.hideBannerCallback?.();
    this.config.onBannerHide?.();
  }

  /**
   * Reject all non-essential cookies
   */
  async rejectAll(): Promise<void> {
    const categories = {
      analytics: false,
      marketing: false,
      functional: true, // Functional is always allowed
    };

    await this.applyConsent(categories);
    storeConsent({ categories }, this.config);

    this.hideBannerCallback?.();
    this.config.onBannerHide?.();
  }

  /**
   * Save custom preferences
   */
  async savePreferences(
    categories: Partial<Omit<ConsentCategories, "necessary">>,
  ): Promise<void> {
    const finalCategories = {
      analytics: categories.analytics ?? false,
      marketing: categories.marketing ?? false,
      functional: categories.functional ?? true,
    };

    await this.applyConsent(finalCategories);
    storeConsent({ categories: finalCategories }, this.config);

    this.hideBannerCallback?.();
    this.config.onBannerHide?.();
  }

  /**
   * Get current consent state
   */
  getConsent(): StoredConsent | null {
    return getStoredConsent(this.config);
  }

  /**
   * Check if user has made a consent choice
   */
  hasConsent(): boolean {
    return getStoredConsent(this.config) !== null;
  }

  /**
   * Reset consent (show banner again)
   */
  resetConsent(): void {
    clearConsent(this.config);
    this.showBannerCallback?.();
    this.config.onBannerShow?.();
  }

  /**
   * Check if user is detected as EU
   */
  isEUUser(): boolean | null {
    return this.isEU;
  }

  /**
   * Get configuration
   */
  getConfig(): ConsentConfig {
    return this.config;
  }
}

/**
 * Create a new ConsentManager instance
 */
export function createConsentManager(
  config: ConsentConfig = {},
): ConsentManager {
  return new ConsentManager(config);
}
