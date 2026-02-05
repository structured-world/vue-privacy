/**
 * @structured-world/vue-privacy
 *
 * GDPR-compliant cookie consent with Google Consent Mode v2 support
 *
 * @example
 * ```ts
 * import { createConsentManager } from '@structured-world/vue-privacy';
 *
 * const manager = createConsentManager({
 *   gaId: 'G-XXXXXXXXXX',
 *   euDetection: 'auto',
 * });
 *
 * await manager.init();
 * ```
 */

// Version
export { VERSION } from "./version";

// Core exports
export { ConsentManager, createConsentManager, CCPA_REGIONS } from "./core/consent-manager";
export {
  getStoredConsent,
  storeConsent,
  clearConsent,
  getConsentUid,
  setConsentUid,
  clearConsentUid,
  fetchRemoteConsent,
  pushRemoteConsent,
  createKVStorage,
} from "./core/storage";
export {
  initGtag,
  setConsentDefaults,
  updateConsent,
  loadGtagScript,
  initGoogleAnalytics,
  categoriesToGoogleSignals,
  trackPageView,
  trackEvent,
} from "./core/gtag";
export { DEFAULT_CONFIG } from "./core/types";

// Geo-detection exports
export {
  CloudflareGeoDetector,
  IPAPIGeoDetector,
  WorkerGeoDetector,
  TimezoneGeoDetector,
  AutoGeoDetector,
  createGeoDetector,
} from "./geo/index";

// Script blocking
export { initScriptBlocker, unblockScriptsByCategory } from "./core/script-blocker";

// i18n exports
export { detectLocale, getTranslations, mergeTranslations } from "./i18n/index";

// Vanilla JS components (banner and modal for non-Vue users)
export {
  createBanner,
  createModal,
  injectVanillaBannerStyles,
  injectVanillaModalStyles,
  BANNER_CSS,
  MODAL_CSS,
} from "./vanilla/index";

// Type exports
export type {
  ConsentConfig,
  ConsentCategories,
  StoredConsent,
  ConsentStorage,
  KVStorageOptions,
  GoogleConsentSignals,
  GeoDetector,
  GeoDetectionResult,
  GeoDetectionLogEntry,
  GeoDetectionResultWithLog,
  BannerConfig,
  PreferenceCenterConfig,
  CategoryDisplayConfig,
  SupportedLocale,
  // GA4 event types
  GA4Item,
  GA4EcommerceParams,
  GA4PurchaseParams,
  GA4GenerateLeadParams,
  GA4RouteEvent,
  GA4RouteMeta,
} from "./core/types";

export type {
  Translations,
  BannerTranslations,
  PreferenceCenterTranslations,
  CategoryTranslations,
  CCPATranslations,
} from "./i18n/types";

// Vanilla component types
export type {
  VanillaBannerOptions,
  VanillaBannerInstance,
  VanillaModalOptions,
  VanillaModalInstance,
  VanillaTheme,
  BannerPosition,
} from "./vanilla/types";
