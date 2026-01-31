import type { ConsentConfig, StoredConsent, ConsentCategories, ConsentStorage } from "./types";
import { DEFAULT_CONFIG } from "./types";
import {
  getStoredConsent,
  storeConsent,
  clearConsent,
  getConsentUid,
  setConsentUid,
  clearConsentUid,
} from "./storage";
import {
  initGoogleAnalytics,
  updateConsent as updateGoogleConsent,
  categoriesToGoogleSignals,
  trackPageView as gtagTrackPageView,
} from "./gtag";
import { createGeoDetector } from "../geo/index";

/**
 * Consent Manager - orchestrates consent flow
 */
export class ConsentManager {
  private config: ConsentConfig;
  private initialized = false;
  private isEU: boolean | null = null;
  private userId: string | null = null;
  private remoteStorage: ConsentStorage | null = null;
  private showBannerCallback: (() => void) | null = null;
  private hideBannerCallback: (() => void) | null = null;

  constructor(config: ConsentConfig = {}) {
    this.config = {
      ...config,
      categories: { ...DEFAULT_CONFIG.categories, ...config.categories },
      banner: { ...DEFAULT_CONFIG.banner, ...config.banner },
      cookie: { ...DEFAULT_CONFIG.cookie, ...config.cookie },
    };

    if (config.storage) {
      this.remoteStorage = config.storage;
    }
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

    // Fast-path: check consent_preferences cookie
    const stored = getStoredConsent(this.config);

    if (stored) {
      await this.applyConsent(stored.categories);
      return;
    }

    // Remote fallback: if storage is configured, try to restore consent
    if (this.remoteStorage) {
      const uid = getConsentUid();
      if (uid) {
        this.userId = uid;
        const version = this.config.version ?? DEFAULT_CONFIG.version;
        const remote = await this.remoteStorage.get(uid, version);
        if (remote) {
          storeConsent({ categories: remote.categories }, this.config);
          await this.applyConsent(remote.categories);
          return;
        }
      }
    }

    // Detect if user is in EU
    const detector =
      this.config.geoDetector ?? createGeoDetector(this.config.euDetection ?? "auto");
    const geoResult = await detector.detect();
    this.isEU = geoResult.isEU;

    if (this.isEU) {
      // EU user: initialize GA with denied defaults, show banner
      if (this.config.gaId) {
        const sendPageView = this.config.sendPageView ?? true;
        await initGoogleAnalytics(this.config.gaId, true, sendPageView);
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
      this.saveConsentWithRemote(grantedCategories);
    }
  }

  /**
   * Persist consent locally and (if remote storage is configured) remotely.
   * Sets cookies only when at least one non-necessary category is accepted.
   * Fire-and-forget: remote push does not block UI.
   */
  private saveConsentWithRemote(categories: Omit<ConsentCategories, "necessary">): void {
    const hasNonNecessary = categories.analytics || categories.marketing;

    if (hasNonNecessary) {
      storeConsent({ categories }, this.config);
    }

    if (this.remoteStorage) {
      const version = this.config.version ?? DEFAULT_CONFIG.version;
      const consent: StoredConsent = { categories, timestamp: Date.now(), version };

      this.remoteStorage.set(this.userId, consent).then((id) => {
        if (id && hasNonNecessary) {
          this.userId = id;
          setConsentUid(id, this.config);
        }
      });
    }
  }

  /**
   * Apply consent settings
   */
  private async applyConsent(categories: Omit<ConsentCategories, "necessary">): Promise<void> {
    // Initialize GA if configured
    if (this.config.gaId) {
      const sendPageView = this.config.sendPageView ?? true;
      await initGoogleAnalytics(this.config.gaId, !categories.analytics, sendPageView);
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
    this.saveConsentWithRemote(categories);

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
      functional: true,
    };

    await this.applyConsent(categories);
    this.saveConsentWithRemote(categories);

    this.hideBannerCallback?.();
    this.config.onBannerHide?.();
  }

  /**
   * Save custom preferences
   */
  async savePreferences(categories: Partial<Omit<ConsentCategories, "necessary">>): Promise<void> {
    const finalCategories = {
      analytics: categories.analytics ?? false,
      marketing: categories.marketing ?? false,
      functional: categories.functional ?? true,
    };

    await this.applyConsent(finalCategories);
    this.saveConsentWithRemote(finalCategories);

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
    clearConsentUid(this.config);
    this.userId = null;
    this.showBannerCallback?.();
    this.config.onBannerShow?.();
  }

  /**
   * Track a page view manually (for SPA navigation).
   * Skips sending if analytics consent has not been granted.
   */
  trackPageView(path: string, title?: string): void {
    const stored = getStoredConsent(this.config);
    if (stored && !stored.categories.analytics) {
      return;
    }
    gtagTrackPageView(path, title);
  }

  /**
   * Check if consent manager has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
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
export function createConsentManager(config: ConsentConfig = {}): ConsentManager {
  return new ConsentManager(config);
}
