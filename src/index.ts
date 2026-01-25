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

// Core exports
export { ConsentManager, createConsentManager } from "./core/consent-manager";
export { getStoredConsent, storeConsent, clearConsent } from "./core/storage";
export {
  initGtag,
  setConsentDefaults,
  updateConsent,
  loadGtagScript,
  initGoogleAnalytics,
  categoriesToGoogleSignals,
} from "./core/gtag";
export { DEFAULT_CONFIG } from "./core/types";

// Geo-detection exports
export {
  CloudflareGeoDetector,
  IPAPIGeoDetector,
  TimezoneGeoDetector,
  AutoGeoDetector,
  createGeoDetector,
} from "./geo/index";

// Type exports
export type {
  ConsentConfig,
  ConsentCategories,
  StoredConsent,
  GoogleConsentSignals,
  GeoDetector,
  GeoDetectionResult,
  BannerConfig,
} from "./core/types";
