import type { SupportedLocale } from "../i18n/types";

/**
 * Consent categories that can be managed
 */
export interface ConsentCategories {
  /** Analytics cookies (e.g., Google Analytics) */
  analytics: boolean;
  /** Marketing/advertising cookies */
  marketing: boolean;
  /** Functional cookies (preferences, etc.) */
  functional: boolean;
  /** Strictly necessary cookies (always true, cannot be disabled) */
  necessary: true;
}

/**
 * Google Consent Mode v2 signals
 * @see https://developers.google.com/tag-platform/security/guides/consent
 */
export interface GoogleConsentSignals {
  /** Controls Google Analytics cookies */
  analytics_storage: "granted" | "denied";
  /** Controls advertising cookies */
  ad_storage: "granted" | "denied";
  /** Controls whether user data can be sent to Google for ads */
  ad_user_data: "granted" | "denied";
  /** Controls personalized advertising */
  ad_personalization: "granted" | "denied";
}

/**
 * Stored consent state
 */
export interface StoredConsent {
  /** Consent categories */
  categories: Omit<ConsentCategories, "necessary">;
  /** Timestamp when consent was given */
  timestamp: number;
  /** Version of the consent configuration */
  version: string;
  /** Whether user was in EU when consent was given */
  isEU?: boolean;
  /** Geo-detection method used when consent was given */
  geoMethod?: "cloudflare" | "worker" | "api" | "fallback" | "manual";
  /** Country code detected when consent was given */
  countryCode?: string;
}

/**
 * Remote consent storage interface.
 * Implement this to use a custom backend (REST, gRPC, IndexedDB, etc.)
 * instead of the default Cloudflare KV Worker.
 */
export interface ConsentStorage {
  /** Fetch stored consent by user ID. Return null if not found or version mismatch. */
  get(uid: string, version: string): Promise<StoredConsent | null>;
  /** Save consent. Return user ID (may generate a new one if uid is null). */
  set(uid: string | null, consent: StoredConsent): Promise<string | null>;
}

/**
 * Options for createKVStorage with rate limiting support.
 */
export interface KVStorageOptions {
  /**
   * Maximum number of retry attempts on 429 rate limit responses. Default: 3
   * Note: This is the total number of attempts, not additional retries after the first.
   * With maxRetries=3, up to 3 fetch calls will be made (initial + 2 retries).
   */
  maxRetries?: number;
  /**
   * Callback invoked when a 429 rate limit response is received.
   * @param retryAfter - Retry delay from Retry-After header (in seconds), or null if not provided
   * @param attempt - Current attempt number (1-based)
   */
  onRateLimited?: (retryAfter: number | null, attempt: number) => void;
}

/**
 * Geo-detection result
 */
export interface GeoDetectionResult {
  /** Whether the user is in the EU */
  isEU: boolean;
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode?: string;
  /** Detection method used */
  method: "cloudflare" | "worker" | "api" | "fallback" | "manual";
}

/**
 * Single geo-detection attempt log entry.
 * Used for debugging to show which methods were tried and their results.
 */
export interface GeoDetectionLogEntry {
  /** Detection method that was attempted */
  method: "cloudflare" | "worker" | "api" | "fallback" | "manual";
  /** Status of this detection attempt */
  status: "success" | "failed" | "skipped";
  /** Result if successful */
  result?: { isEU: boolean; countryCode?: string };
  /** Error message if failed */
  error?: string;
  /** Duration of the attempt in milliseconds */
  duration: number;
}

/**
 * Extended geo-detection result with detection log.
 * Used by AutoGeoDetector to provide debugging information.
 */
export interface GeoDetectionResultWithLog extends GeoDetectionResult {
  /** Log of all detection attempts (only present when using AutoGeoDetector) */
  log?: GeoDetectionLogEntry[];
}

/**
 * Geo-detection provider interface
 */
export interface GeoDetector {
  /** Detect if user is in the EU */
  detect(): Promise<GeoDetectionResult | GeoDetectionResultWithLog>;
}

/**
 * Category display configuration for preference center
 */
export interface CategoryDisplayConfig {
  /** Display name */
  name: string;
  /** Description text */
  description: string;
}

/**
 * Preference center modal configuration
 */
export interface PreferenceCenterConfig {
  /** Modal title */
  title: string;
  /** Modal description/subtitle */
  description: string;
  /** Save preferences button text */
  savePreferences: string;
  /** Accept all button text */
  acceptAll: string;
  /** Category display text overrides */
  categories: {
    necessary: Partial<CategoryDisplayConfig>;
    analytics: Partial<CategoryDisplayConfig>;
    marketing: Partial<CategoryDisplayConfig>;
    functional: Partial<CategoryDisplayConfig>;
  };
}

/**
 * Banner UI configuration
 */
export interface BannerConfig {
  /** Banner title */
  title: string;
  /** Main message text */
  message: string;
  /** Accept all button text */
  acceptAll: string;
  /** Reject all button text */
  rejectAll: string;
  /** Customize preferences button text */
  customize?: string;
  /** Privacy policy link */
  privacyLink?: string;
  /** Privacy policy link text */
  privacyLinkText?: string;
}

/**
 * Supported locale codes for built-in translations
 */
export type { SupportedLocale } from "../i18n/types";

/**
 * GA4 Item object for ecommerce events.
 * Per GA4 spec, at least one of item_id or item_name is required.
 * Note: TypeScript cannot enforce "at least one of" constraint with a simple interface.
 * The GA4 API validates this at runtime and logs warnings for invalid items.
 * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events
 */
export interface GA4Item {
  /** SKU or product ID (required if item_name not provided) */
  item_id?: string;
  /** Product name (required if item_id not provided) */
  item_name?: string;
  /** Affiliate or partner name */
  affiliation?: string;
  /** Coupon code applied to item */
  coupon?: string;
  /** Discount amount */
  discount?: number;
  /** Index/position in list */
  index?: number;
  /** Brand name */
  item_brand?: string;
  /** Primary category */
  item_category?: string;
  /** Category hierarchy level 2 */
  item_category2?: string;
  /** Category hierarchy level 3 */
  item_category3?: string;
  /** Category hierarchy level 4 */
  item_category4?: string;
  /** Category hierarchy level 5 */
  item_category5?: string;
  /** List ID where item was shown */
  item_list_id?: string;
  /** List name */
  item_list_name?: string;
  /** Variant (size, color) */
  item_variant?: string;
  /** Google Business location ID */
  location_id?: string;
  /** Unit price */
  price?: number;
  /** Quantity */
  quantity?: number;
}

/**
 * GA4 Ecommerce event parameters (add_to_cart, begin_checkout, view_item, etc.)
 */
export interface GA4EcommerceParams {
  /** 3-letter ISO 4217 currency code (e.g., 'USD', 'EUR') */
  currency: string;
  /** Monetary value */
  value: number;
  /** Array of items (max 200) */
  items: GA4Item[];
  /** Coupon code */
  coupon?: string;
}

/**
 * GA4 Purchase event parameters.
 * @see https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */
export interface GA4PurchaseParams extends GA4EcommerceParams {
  /** Unique transaction ID (required for purchase) */
  transaction_id: string;
  /** Shipping cost */
  shipping?: number;
  /** Tax amount */
  tax?: number;
  /** Customer type */
  customer_type?: "new" | "returning";
}

/**
 * GA4 Generate Lead event parameters
 */
export interface GA4GenerateLeadParams {
  /** Monetary value of the lead */
  value?: number;
  /** Currency code */
  currency?: string;
  /** Lead source (custom parameter) */
  lead_source?: string;
}

/**
 * GA4 event definition for route meta.
 */
export interface GA4RouteEvent {
  /** GA4 event name (e.g., 'sign_up', 'generate_lead', 'purchase') */
  name: string;
  /** Event parameters */
  params?: Record<string, unknown>;
}

/**
 * Route meta fields for GA4 analytics integration with Vue Router.
 * Add these to your route definitions to automatically track events on navigation.
 *
 * @example
 * ```typescript
 * const routes = [
 *   {
 *     path: '/signup/complete',
 *     component: SignupComplete,
 *     meta: {
 *       ga4Title: 'Registration Complete',
 *       ga4Event: { name: 'sign_up', params: { method: 'email' } }
 *     }
 *   }
 * ]
 * ```
 */
export interface GA4RouteMeta {
  /** Custom page title for GA4 page_view event (overrides document.title) */
  ga4Title?: string;
  /** GA4 event to fire automatically on page visit */
  ga4Event?: GA4RouteEvent;
}

/**
 * Main plugin configuration
 */
export interface ConsentConfig {
  /** Google Analytics measurement ID (G-XXXXXXXXXX) */
  gaId?: string;

  /**
   * Locale for UI text. Auto-detected from navigator.language if not set.
   * Supported: en, de, fr, es, it, pt, nl, pl, ru, uk, ja, zh, ko
   */
  locale?: SupportedLocale;

  /** Consent categories to manage */
  categories?: Partial<Omit<ConsentCategories, "necessary">>;

  /** Banner UI configuration */
  banner?: Partial<BannerConfig>;

  /** Cookie configuration */
  cookie?: {
    /** Cookie name for storing consent */
    name?: string;
    /** Cookie expiry in days */
    expiry?: number;
    /** Cookie domain */
    domain?: string;
    /** Cookie path */
    path?: string;
  };

  /**
   * EU detection mode:
   * - 'auto': Try Cloudflare header, then Worker /api/geo (if geoUrl set), then IP API, then timezone
   * - 'cloudflare': Only use Cloudflare header
   * - 'worker': Only use Worker /api/geo (requires geoUrl)
   * - 'api': Only use IP API (ipapi.co)
   * - 'always': Always show banner (treat all as EU)
   * - 'never': Never show banner (treat all as non-EU)
   */
  euDetection?: "auto" | "cloudflare" | "worker" | "api" | "always" | "never";

  /** URL for Worker-based geo detection (e.g. "/api/geo"). Used by "worker" and "auto" modes. */
  geoUrl?: string;

  /** Custom geo-detection provider */
  geoDetector?: GeoDetector;

  /**
   * Whether to send automatic page_view on GA initialization.
   * Set to false for SPA apps (VitePress, Vue Router) where you track navigation manually.
   * @default true
   */
  sendPageView?: boolean;

  /**
   * Remote consent storage implementation.
   * When set, consent is persisted remotely and cookie is used
   * only for re-identification. No cookies are set before consent.
   *
   * Use `createKVStorage('/api/consent')` for Cloudflare KV Worker,
   * or implement ConsentStorage interface for custom backends.
   */
  storage?: ConsentStorage;

  /** Consent version (changing this resets consent for all users) */
  version?: string;

  /** Callback when consent changes */
  onConsentChange?: (consent: StoredConsent) => void;

  /** Callback when banner is shown */
  onBannerShow?: () => void;

  /** Callback when banner is hidden */
  onBannerHide?: () => void;

  /** Preference center modal configuration (text overrides) */
  preferenceCenter?: Partial<PreferenceCenterConfig>;

  /** Callback when preference center is shown */
  onPreferenceCenterShow?: () => void;

  /** Callback when preference center is hidden */
  onPreferenceCenterHide?: () => void;
}

/**
 * Required cookie configuration (with defaults)
 */
export interface CookieConfigDefaults {
  name: string;
  expiry: number;
  path: string;
  domain?: string;
}

/**
 * Required banner configuration (with defaults)
 */
export interface BannerConfigDefaults {
  title: string;
  message: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  privacyLink: string;
  privacyLinkText: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: {
  categories: Omit<ConsentCategories, "necessary">;
  banner: BannerConfigDefaults;
  cookie: CookieConfigDefaults;
  euDetection: "auto" | "cloudflare" | "worker" | "api" | "always" | "never";
  version: string;
} = {
  categories: {
    analytics: false,
    marketing: false,
    functional: true,
  },
  banner: {
    title: "Cookie Consent",
    message:
      "We use cookies to improve your experience. You can accept all cookies or customize your preferences.",
    acceptAll: "Accept All",
    rejectAll: "Reject All",
    customize: "Customize",
    privacyLink: "/privacy",
    privacyLinkText: "Privacy Policy",
  },
  cookie: {
    name: "consent_preferences",
    expiry: 365,
    path: "/",
  },
  euDetection: "auto",
  version: "1.0",
};
