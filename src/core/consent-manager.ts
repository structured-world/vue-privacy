import type {
  ConsentConfig,
  StoredConsent,
  ConsentCategories,
  ConsentStorage,
  GeoDetectionResult,
  GA4EcommerceParams,
  GA4PurchaseParams,
  GA4GenerateLeadParams,
} from "./types";
import { DEFAULT_CONFIG } from "./types";
import { detectLocale } from "../i18n/index";
import type { SupportedLocale } from "../i18n/types";
import { initScriptBlocker } from "./script-blocker";
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
  trackEvent as gtagTrackEvent,
} from "./gtag";
import { createGeoDetector } from "../geo/index";

/**
 * Consent Manager - orchestrates consent flow
 */
export class ConsentManager {
  private config: ConsentConfig;
  private locale: SupportedLocale;
  private initialized = false;
  private isEU: boolean | null = null;
  private geoResult: GeoDetectionResult | null = null;
  private userId: string | null = null;
  private remoteStorage: ConsentStorage | null = null;
  private showBannerCallback: (() => void) | null = null;
  private hideBannerCallback: (() => void) | null = null;
  private showPreferenceCenterCallback: (() => void) | null = null;
  private hidePreferenceCenterCallback: (() => void) | null = null;
  private scriptBlockerCleanup: (() => void) | null = null;
  private routerCleanup: (() => void) | null = null;
  private bannerPending = false;
  private preferenceCenterPending = false;
  private consentChangeListeners: Array<
    (categories: Omit<ConsentCategories, "necessary">) => void
  > = [];

  constructor(config: ConsentConfig = {}) {
    this.locale = config.locale ?? detectLocale();
    this.config = {
      ...config,
      locale: this.locale,
      categories: { ...DEFAULT_CONFIG.categories, ...config.categories },
      banner: { ...DEFAULT_CONFIG.banner, ...config.banner },
      cookie: { ...DEFAULT_CONFIG.cookie, ...config.cookie },
    };

    if (config.storage) {
      this.remoteStorage = config.storage;
    }
  }

  /**
   * Register callback to show banner.
   * If init() already requested the banner before this callback was registered,
   * fires immediately (handles race condition with component mount timing).
   */
  onShowBanner(callback: () => void): void {
    this.showBannerCallback = callback;
    if (this.bannerPending) {
      this.bannerPending = false;
      callback();
    }
  }

  /**
   * Register callback to hide banner
   */
  onHideBanner(callback: () => void): void {
    this.hideBannerCallback = callback;
  }

  /**
   * Register (or clear) callback to show preference center.
   * Pass null to unregister.
   * If showPreferenceCenter() was called before this callback was registered,
   * fires immediately (same race-condition handling as banner).
   */
  onShowPreferenceCenter(callback: (() => void) | null): void {
    this.showPreferenceCenterCallback = callback;
    if (callback && this.preferenceCenterPending) {
      this.preferenceCenterPending = false;
      callback();
    }
  }

  /**
   * Register (or clear) callback to hide preference center.
   * Pass null to unregister.
   */
  onHidePreferenceCenter(callback: (() => void) | null): void {
    this.hidePreferenceCenterCallback = callback;
  }

  /**
   * Register a listener that fires whenever consent categories change.
   * Used internally by the script blocker; also available for external consumers.
   */
  onConsentChange(listener: (categories: Omit<ConsentCategories, "necessary">) => void): void {
    this.consentChangeListeners.push(listener);
  }

  /**
   * Programmatically show the preference center modal
   */
  showPreferenceCenter(): void {
    if (this.showPreferenceCenterCallback) {
      this.showPreferenceCenterCallback();
    } else {
      this.preferenceCenterPending = true;
    }
    this.config.onPreferenceCenterShow?.();
  }

  /**
   * Get the resolved locale
   */
  getLocale(): SupportedLocale {
    return this.locale;
  }

  /**
   * Initialize consent manager
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Initialize script blocker (auto-unblocks on consent change)
    if (typeof document !== "undefined") {
      this.scriptBlockerCleanup = initScriptBlocker(this);
    }

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
        try {
          const remote = await this.remoteStorage.get(uid, version);
          if (remote) {
            // consent_uid cookie exists only for users who accepted — safe to restore cookie
            storeConsent({ categories: remote.categories }, this.config);
            await this.applyConsent(remote.categories);
            return;
          }
        } catch {
          // Remote storage failed — fall through to geo detection
        }
      }
    }

    // Detect if user is in EU
    const detector =
      this.config.geoDetector ??
      createGeoDetector(this.config.euDetection ?? "auto", this.config.geoUrl);
    const geoResult = await detector.detect();
    this.isEU = geoResult.isEU;
    this.geoResult = geoResult;

    if (this.isEU) {
      // EU user: initialize GA with denied defaults, show banner
      if (this.config.gaId) {
        const sendPageView = this.config.sendPageView ?? true;
        await initGoogleAnalytics(this.config.gaId, true, sendPageView);
      }

      // Show banner (or defer if component hasn't mounted yet)
      if (this.showBannerCallback) {
        this.showBannerCallback();
      } else {
        this.bannerPending = true;
      }
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

      this.remoteStorage
        .set(this.userId, consent)
        .then((id) => {
          if (id && hasNonNecessary) {
            this.userId = id;
            setConsentUid(id, this.config);
          }
        })
        .catch(() => {
          // Silent fail — remote storage is best-effort, local cookies are primary
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

    // Notify config callback
    this.config.onConsentChange?.({
      categories,
      timestamp: Date.now(),
      version: this.config.version ?? DEFAULT_CONFIG.version,
    });

    // Notify registered listeners (script blocker, etc.)
    for (const listener of this.consentChangeListeners) {
      listener(categories);
    }
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
    this.hidePreferenceCenterCallback?.();
    this.config.onBannerHide?.();
    this.config.onPreferenceCenterHide?.();
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
    this.hidePreferenceCenterCallback?.();
    this.config.onBannerHide?.();
    this.config.onPreferenceCenterHide?.();
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
    this.hidePreferenceCenterCallback?.();
    this.config.onBannerHide?.();
    this.config.onPreferenceCenterHide?.();
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
   * Skips sending if analytics consent is explicitly denied.
   * Before user makes a choice, page views are sent under Consent Mode defaults (cookieless pings).
   */
  trackPageView(path: string, title?: string): void {
    const stored = getStoredConsent(this.config);
    // Intentional: Only suppress when user EXPLICITLY denied analytics.
    // Before user makes a choice (no cookie), page views are sent under Google Consent Mode v2
    // defaults - cookieless pings with no tracking cookies set. This is GDPR-compliant.
    if (stored && !stored.categories.analytics) {
      return;
    }
    gtagTrackPageView(path, title);
  }

  /**
   * Track a custom event (GA4 recommended events, ecommerce, or custom).
   * Skips sending if analytics consent is explicitly denied.
   * Before user makes a choice, events are sent under Consent Mode defaults (cookieless pings).
   *
   * @param eventName - GA4 event name (e.g., 'sign_up', 'purchase', 'add_to_cart')
   * @param params - Event parameters
   *
   * @example
   * ```typescript
   * manager.trackEvent('sign_up', { method: 'email' });
   * manager.trackEvent('purchase', { transaction_id: 'T_123', value: 99.99, currency: 'USD', items: [...] });
   * ```
   */
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    // Read consent state fresh on every call — handles runtime changes from
    // acceptAll/rejectAll/savePreferences without needing instance state sync.
    const stored = getStoredConsent(this.config);
    // Intentional: Only suppress when user EXPLICITLY denied analytics.
    // Before user makes a choice (no cookie), events are sent under Google Consent Mode v2
    // defaults - cookieless pings with no tracking cookies set. This is GDPR-compliant.
    if (stored && !stored.categories.analytics) {
      return;
    }
    gtagTrackEvent(eventName, params);
  }

  // --- Typed GA4 Ecommerce Helpers ---
  // Cast to Record<string, unknown> is intentional: these methods provide strict
  // compile-time types for GA4 params while trackEvent() stays flexible for custom events.
  // The cast is safe because GA4 params are plain objects compatible with gtag().

  /**
   * Track a purchase event with typed parameters.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
   */
  trackPurchase(params: GA4PurchaseParams): void {
    this.trackEvent("purchase", params as unknown as Record<string, unknown>);
  }

  /**
   * Track add_to_cart event.
   */
  trackAddToCart(params: GA4EcommerceParams): void {
    this.trackEvent("add_to_cart", params as unknown as Record<string, unknown>);
  }

  /**
   * Track begin_checkout event.
   */
  trackBeginCheckout(params: GA4EcommerceParams): void {
    this.trackEvent("begin_checkout", params as unknown as Record<string, unknown>);
  }

  /**
   * Track view_item event.
   */
  trackViewItem(params: GA4EcommerceParams): void {
    this.trackEvent("view_item", params as unknown as Record<string, unknown>);
  }

  /**
   * Track view_item_list event.
   */
  trackViewItemList(
    params: Omit<GA4EcommerceParams, "value"> & { item_list_id?: string; item_list_name?: string }
  ): void {
    this.trackEvent("view_item_list", params as unknown as Record<string, unknown>);
  }

  /**
   * Track select_item event (click on product in list).
   */
  trackSelectItem(
    params: Omit<GA4EcommerceParams, "value"> & { item_list_id?: string; item_list_name?: string }
  ): void {
    this.trackEvent("select_item", params as unknown as Record<string, unknown>);
  }

  /**
   * Track add_shipping_info event.
   */
  trackAddShippingInfo(params: GA4EcommerceParams & { shipping_tier?: string }): void {
    this.trackEvent("add_shipping_info", params as unknown as Record<string, unknown>);
  }

  /**
   * Track add_payment_info event.
   */
  trackAddPaymentInfo(params: GA4EcommerceParams & { payment_type?: string }): void {
    this.trackEvent("add_payment_info", params as unknown as Record<string, unknown>);
  }

  /**
   * Track sign_up event.
   * @param method - Registration method (e.g., 'email', 'google', 'facebook')
   */
  trackSignUp(method?: string): void {
    this.trackEvent("sign_up", method ? { method } : undefined);
  }

  /**
   * Track login event.
   * @param method - Login method (e.g., 'email', 'google', 'facebook')
   */
  trackLogin(method?: string): void {
    this.trackEvent("login", method ? { method } : undefined);
  }

  /**
   * Track generate_lead event (form submission, contact request).
   */
  trackGenerateLead(params?: GA4GenerateLeadParams): void {
    this.trackEvent("generate_lead", params as Record<string, unknown> | undefined);
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
   * Get geo-detection result (country, method, isEU).
   * Returns null if geo detection has not run yet (e.g., consent was restored from cookie).
   */
  getGeoResult(): GeoDetectionResult | null {
    return this.geoResult;
  }

  /**
   * Get configuration
   */
  getConfig(): ConsentConfig {
    return this.config;
  }

  /**
   * Register router tracking cleanup function.
   * Called internally by setupRouterTracking when used with the Vue plugin.
   * @internal
   */
  setRouterCleanup(cleanup: (() => void) | null): void {
    // Call previous cleanup before overwriting (in case router tracking is re-initialized)
    this.routerCleanup?.();
    this.routerCleanup = cleanup;
  }

  /**
   * Clean up resources (script blocker observer, router tracking, etc.).
   * Call when unmounting the app.
   */
  destroy(): void {
    this.scriptBlockerCleanup?.();
    this.scriptBlockerCleanup = null;

    this.routerCleanup?.();
    this.routerCleanup = null;

    this.consentChangeListeners.length = 0;
    this.showBannerCallback = null;
    this.hideBannerCallback = null;
    this.showPreferenceCenterCallback = null;
    this.hidePreferenceCenterCallback = null;
  }
}

/**
 * Create a new ConsentManager instance
 */
export function createConsentManager(config: ConsentConfig = {}): ConsentManager {
  return new ConsentManager(config);
}
