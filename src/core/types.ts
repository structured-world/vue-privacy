import type { SupportedLocale } from "../i18n/types";
import type { ConsentJurisdiction } from "../geo/jurisdictions";

export type { ConsentJurisdiction } from "../geo/jurisdictions";

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

/** An optional consent category: every category except the always-on `necessary`. */
export type OptionalCategory = Exclude<keyof ConsentCategories, "necessary">;

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
 * Google tag fields for a GA4 stream, valid in both `gtag('set', ...)` and
 * `gtag('config', ...)`. Names are case-sensitive.
 * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/config
 */
export interface GoogleAnalyticsFields {
  /** `false` turns off Google signals (reporting based on advertising identifiers) */
  allow_google_signals?: boolean;
  /** `false` turns off advertising personalisation */
  allow_ad_personalization_signals?: boolean;
  /** Overrides `utm_content` */
  campaign_content?: string;
  /** Overrides `utm_id` */
  campaign_id?: string;
  /** Overrides `utm_medium` */
  campaign_medium?: string;
  /** Overrides `utm_campaign` */
  campaign_name?: string;
  /** Overrides `utm_source` */
  campaign_source?: string;
  /** Overrides `utm_term` */
  campaign_term?: string;
  /** Pseudonymous browser identifier; random per browser by default */
  client_id?: string;
  /** Content group of the page, e.g. `/news/sports` */
  content_group?: string;
  /** `'auto'` (default: the highest domain the browser accepts), `'none'`, or a domain */
  cookie_domain?: string;
  /** Lifetime of the `_ga*` cookies in seconds (default two years); `0` makes them session cookies */
  cookie_expires?: number;
  /** Extra cookie attributes separated by semicolons, e.g. `SameSite=None;Secure` */
  cookie_flags?: string;
  /** Path the `_ga*` cookies are set on (default `/`) */
  cookie_path?: string;
  /** Prefix prepended to the `_ga*` cookie names */
  cookie_prefix?: string;
  /** `false`: the cookie lifetime counts from the first visit instead of every page load */
  cookie_update?: boolean;
  /** `true`: the referrer is not reported as a traffic source */
  ignore_referrer?: boolean;
  /** Language preference (default `navigator.language`) */
  language?: string;
  /** Full page URL (default `document.location`) */
  page_location?: string;
  /** Referring URL (default `document.referrer`) */
  page_referrer?: string;
  /** Page title (default `document.title`) */
  page_title?: string;
  /** Screen size as `<width>x<height>`, e.g. `800x600` */
  screen_resolution?: string;
  /** The site's own user identifier; never personal data */
  user_id?: string;
  /** User-scoped custom dimensions, e.g. `{ favorite_color: "blue" }` */
  user_properties?: Record<string, string | number>;
}

/**
 * Fields of the `gtag('config', gaId, ...)` call. `send_page_view` is set by
 * {@link ConsentConfig.sendPageView}, which the SPA integrations turn off.
 */
export interface GoogleAnalyticsConfigFields extends GoogleAnalyticsFields {
  /**
   * Show this stream's events in DebugView. Only `true` is accepted: Google keeps debug mode on
   * for `false` too, and turns it off only when the field is absent.
   */
  debug_mode?: true;
}

/** Names the typed blocks own; a custom parameter must not reuse them. */
type ReservedGoogleAnalyticsField = keyof GoogleAnalyticsConfigFields | "send_page_view";

/**
 * How the Google tag for `gaId` is configured: data minimisation (signals, ad personalisation,
 * cookie lifetime and scope) and other documented fields, without calling `gtag()` outside the
 * consent flow.
 */
export interface GoogleAnalyticsOptions {
  /**
   * Fields of the `config` call for `gaId`. A page whose own snippet already queued `config` for
   * that ID keeps its call (a second one would count a second page view): set the fields there.
   */
  config?: GoogleAnalyticsConfigFields;
  /**
   * Custom parameters merged into the `config` call (custom dimensions, undocumented fields).
   * Documented fields belong in `config`, where their names and types are checked.
   */
  customParameters?: Record<string, unknown> & {
    [K in ReservedGoogleAnalyticsField]?: never;
  };
  /**
   * Fields passed through `gtag('set', ...)` ahead of the queued measurement commands; they apply
   * to every Google tag, one the site configured itself included
   */
  set?: GoogleAnalyticsFields;
  /**
   * While `ad_storage` is denied, strip ad click identifiers from Google Ads and Floodlight
   * requests (`gtag('set', 'ads_data_redaction', ...)`).
   */
  adsDataRedaction?: boolean;
  /**
   * While consent is denied, carry ad click, client and session identifiers between pages in
   * link URLs instead of cookies (`gtag('set', 'url_passthrough', ...)`).
   */
  urlPassthrough?: boolean;
}

/**
 * Stored consent state. The consent cookie is strictly necessary storage (ePrivacy Directive
 * 2002/58/EC, Art. 5(3)), set without consent to remember the choice, so it holds these fields
 * and no location.
 */
export interface StoredConsent {
  /** Consent categories */
  categories: Omit<ConsentCategories, "necessary">;
  /** Timestamp when consent was given */
  timestamp: number;
  /** Version of the consent configuration */
  version: string;
  /**
   * Whether the choice was made in a consent jurisdiction (see
   * {@link ConsentConfig.consentJurisdictions}); such a choice stands wherever the visitor goes
   */
  consentRequired?: boolean;
}

/**
 * Remote consent storage interface.
 * Implement this to use a custom backend (REST, gRPC, IndexedDB, etc.)
 * instead of the default Cloudflare KV Worker.
 */
export interface ConsentStorage {
  /** Fetch stored consent by user ID. Return null if not found or version mismatch. */
  get(uid: string, version: string): Promise<StoredConsent | null>;
  /**
   * Save consent. Return user ID (may generate a new one if uid is null).
   *
   * `signal` aborts when a newer choice supersedes this write; stop the request then (pass it
   * to `fetch`). A write that ignores it is waited for at most 10 seconds before the newer
   * write starts, and may then still land after it.
   */
  set(uid: string | null, consent: StoredConsent, signal?: AbortSignal): Promise<string | null>;
}

/**
 * Options for createKVStorage with rate limiting support.
 */
export interface KVStorageOptions {
  /**
   * Total number of fetch attempts on 429 rate limit responses. Default: 3
   *
   * Examples:
   * - maxRetries=1: Single attempt, no retries
   * - maxRetries=3: Up to 3 attempts (1 initial + 2 retries, delays: 1s, 2s)
   * - maxRetries=5: Up to 5 attempts (1 initial + 4 retries, delays: 1s, 2s, 4s, 8s)
   *
   * Note: Named "maxRetries" for API consistency with common retry libraries,
   * though it represents total attempts, not additional retries.
   */
  maxRetries?: number;
  /**
   * Callback invoked when a 429 rate limit response is received.
   *
   * Called before each retry delay. Useful for logging or user notification.
   * Note: Exceptions from callback are caught and do not abort the retry loop.
   *
   * @param retryAfter - Retry delay from server's Retry-After header (in seconds), or null if not provided/invalid
   * @param attempt - Current attempt number (1-based)
   */
  onRateLimited?: (retryAfter: number | null, attempt: number) => void;
}

/**
 * Geo-detection result
 */
export interface GeoDetectionResult {
  /**
   * Whether the visitor is in a consent jurisdiction. With `countryCode` set the consent manager
   * decides from the country and its `consentJurisdictions` instead; a detector that cannot
   * tell throws, and the manager applies `geoFailure`.
   */
  consentRequired: boolean;
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode?: string;
  /** Region/state code (e.g., "California", "CA" for US states) */
  region?: string;
  /** Detection method used; `stored`: no lookup, the stored choice's jurisdiction */
  method: "cloudflare" | "worker" | "api" | "fallback" | "manual" | "stored";
}

/**
 * Single geo-detection attempt log entry.
 * Used for debugging to show which methods were tried and their results.
 */
export interface GeoDetectionLogEntry {
  /** Detection method that was attempted */
  method: "cloudflare" | "worker" | "api" | "fallback" | "manual" | "stored";
  /** Status of this detection attempt */
  status: "success" | "failed" | "skipped";
  /** Result if successful */
  result?: { consentRequired: boolean; countryCode?: string; region?: string };
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
  /** Detect the visitor's country, and whether it requires consent; throw when unknown */
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
  /** Reject all button text; the translated banner text when omitted */
  rejectAll?: string;
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
   * Supported: every official EU language (bg, cs, da, de, el, en, es, et, fi, fr, ga, hr, hu,
   * it, lt, lv, mt, nl, pl, pt, ro, sk, sl, sv), nb and is, and ja, ko, ru, uk, zh
   */
  locale?: SupportedLocale;

  /** Consent categories to manage */
  categories?: Partial<Omit<ConsentCategories, "necessary">>;

  /**
   * The optional categories the site actually uses. The preference centres show only these
   * (besides `necessary`), and every other category is always refused: no choice, implied
   * grant or stored consent turns it on, so its Google signals stay denied.
   * @default ["analytics", "marketing", "functional"]
   */
  usedCategories?: OptionalCategory[];

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

  /**
   * Jurisdictions whose visitors are asked for consent; elsewhere every category is granted.
   * `EEA`: the EU member states (outermost regions and Åland included), Iceland, Liechtenstein
   * and Norway. `UK`: the United Kingdom. `CH`: Switzerland. The visitor's country decides;
   * a detector that reports none decides itself.
   * @default ["EEA", "UK"]
   */
  consentJurisdictions?: ConsentJurisdiction[];

  /**
   * What a failed geo lookup means (a blocked IP API, a browser reporting UTC):
   * - `'require-consent'` (default): the visitor is asked, since a failure is no evidence of
   *   being outside a consent jurisdiction. A choice stored outside them is asked again too.
   * - `'grant'`: the visitor is treated as outside consent jurisdictions.
   * @default 'require-consent'
   */
  geoFailure?: "require-consent" | "grant";

  /** Custom geo-detection provider */
  geoDetector?: GeoDetector;

  /**
   * Whether to send automatic page_view on GA initialization.
   * Set to false for SPA apps (VitePress, Vue Router) where you track navigation manually.
   * @default true
   */
  sendPageView?: boolean;

  /**
   * Configuration of the Google tag for `gaId`: `config` and `set` fields, Consent Mode's
   * `ads_data_redaction` and `url_passthrough`. Sent once, after the consent default and before
   * the tag loads; in basic mode, only once the visitor allows analytics.
   */
  googleAnalytics?: GoogleAnalyticsOptions;

  /**
   * How the Google tag for `gaId` relates to consent (Google Consent Mode):
   * - `'advanced'` (default): gtag.js loads for every visitor with denied defaults, and Google
   *   receives cookieless pings (page views, events) before any choice and after a refusal.
   * - `'basic'`: nothing reaches Google (no script, no dataLayer entry, no request) until the
   *   visitor explicitly allows analytics; a grant implied by the jurisdiction (CCPA, outside
   *   consent jurisdictions) does not count. Withdrawing analytics switches a loaded tag off
   *   (`ga-disable-<ID>`) and deletes the `_ga` cookies.
   *   Choose it when the site promises "Google Analytics only with consent"; Google then
   *   models no conversions for visitors who did not consent. Requires `gaId` (the manager
   *   loads the tag); a site that loads gtag itself cannot keep that promise, and the
   *   constructor throws.
   * @default 'advanced'
   */
  consentMode?: "advanced" | "basic";

  /**
   * Basic mode only: reload the page when the visitor withdraws analytics after the Google tag
   * has loaded on it. A withdrawal stops Google Analytics on the spot, but other products linked
   * to the same Google tag (Google Ads, Floodlight) keep sending cookieless pings until the page
   * reloads, and a running script cannot be unloaded. The choice is saved first (a remote write
   * through `storage` is waited for, up to 10 seconds) and the consent callbacks run; the reload follows even if they destroy the manager, since the tag runs
   * page-wide, and is dropped if they allow analytics again. It drops in-page state, so enable it deliberately. While analytics stays allowed
   * the tag loads, and linked advertising products follow the ad signals (cookieless pings when
   * marketing is refused); keep them in a separate tag if refusing marketing must stop them.
   * @default false
   */
  reloadOnWithdrawal?: boolean;

  /**
   * Called when gtag.js fails to load (an ad blocker, a network error). The consent flow is
   * not affected: the banner still shows and choices are saved; the next consent change
   * retries the load.
   */
  onGoogleAnalyticsError?: (error: unknown) => void;

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

  /**
   * Callback when consent changes. In basic mode it also runs for a choice made in another tab
   * of the site, once this tab follows it. An error it throws is logged and does not stop the
   * consent from taking effect.
   */
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

  /**
   * Enable CCPA compliance mode for US users in California, Virginia, Colorado, etc.
   * When enabled, CCPA users see no consent banner but can opt-out via "Do Not Sell" link.
   * @default false
   */
  ccpaEnabled?: boolean;

  /**
   * Text for "Do Not Sell My Personal Information" link (CCPA requirement).
   * This is a configuration option for YOUR UI — vue-privacy does not render this link.
   * Use this value in your footer/navigation component when `isCCPAUser()` returns true.
   *
   * When clicked, call `manager.showPreferenceCenter()` to let user opt-out of marketing.
   *
   * If not provided, use `getTranslations(locale).ccpa.doNotSell` from i18n.
   *
   * @example
   * ```vue
   * <a v-if="consent.isCCPAUser()" @click="consent.showPreferenceCenter()">
   *   {{ config.doNotSellText ?? translations.ccpa.doNotSell }}
   * </a>
   * ```
   */
  doNotSellText?: string;

  /** Callback when user is detected as CCPA user */
  onCCPAUser?: () => void;
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
