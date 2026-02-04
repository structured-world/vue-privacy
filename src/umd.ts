/**
 * @structured-world/vue-privacy — UMD/IIFE entry point
 *
 * Framework-agnostic build for <script> tag usage via CDN.
 * Exposed as global `VuePrivacy` namespace.
 *
 * @example
 * ```html
 * <script src="https://unpkg.com/@structured-world/vue-privacy"></script>
 * <script>
 *   const manager = VuePrivacy.createConsentManager({
 *     gaId: 'G-XXXXXXXXXX',
 *     euDetection: 'auto',
 *   });
 *   manager.init();
 * </script>
 * ```
 */

// Core consent management
export { ConsentManager, createConsentManager } from "./core/consent-manager";

// Storage utilities
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

// Google Analytics integration
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

// Geo-detection
export {
  CloudflareGeoDetector,
  IPAPIGeoDetector,
  WorkerGeoDetector,
  TimezoneGeoDetector,
  AutoGeoDetector,
  createGeoDetector,
} from "./geo/index";

// Config defaults
export { DEFAULT_CONFIG } from "./core/types";

// Script blocking
export { initScriptBlocker, unblockScriptsByCategory } from "./core/script-blocker";

// i18n
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

// Type exports (stripped at build time, useful for TS consumers of UMD)
export type {
  ConsentConfig,
  ConsentCategories,
  StoredConsent,
  ConsentStorage,
  GoogleConsentSignals,
  GeoDetector,
  GeoDetectionResult,
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

export type { Translations } from "./i18n/types";

// Vanilla component types
export type {
  VanillaBannerOptions,
  VanillaBannerInstance,
  VanillaModalOptions,
  VanillaModalInstance,
  VanillaTheme,
  BannerPosition,
} from "./vanilla/types";
