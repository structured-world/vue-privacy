---
description: TypeScript types of Vue Privacy, the Vue 3 cookie consent library. Every ConsentConfig option (languages, theme, region detection, Consent Mode), StoredConsent, ConsentRequest and the GA4 ecommerce event types.
---

# TypeScript Type Definitions

## ConsentConfig

Main configuration interface.

```typescript
interface ConsentConfig {
  /** Google Analytics measurement ID (G-XXXXXXXXXX) */
  gaId?: string;

  /**
   * UI language. When not set: the first of the browser's preferred languages among
   * `locales`, else `fallbackLocale`. setLocale() switches it later. See the Languages guide.
   */
  locale?: SupportedLocale;

  /** The locales the site offers; detection and setLocale() pick only among these. Default: all 31 */
  locales?: SupportedLocale[];

  /** Shown when none of the visitor's languages is offered. Default: 'en', else the first of `locales` */
  fallbackLocale?: SupportedLocale;

  /** Colour palette of the banner and the preference centre; a component's own `theme` outranks it */
  theme?: ConsentTheme; // 'auto' (default) | 'light' | 'dark'

  /**
   * Optional categories the site uses; the rest are never offered or granted. Default: all three.
   * They start unticked for a visitor who has not chosen (a pre-ticked box is no consent).
   */
  usedCategories?: OptionalCategory[]; // 'analytics' | 'marketing' | 'functional'

  /** Banner text (overrides the translation in every language) */
  banner?: Partial<BannerConfig>;

  /** Preference centre text (overrides the translation in every language) */
  preferenceCenter?: Partial<PreferenceCenterConfig>;

  /** Cookie configuration */
  cookie?: {
    name?: string; // Default: 'consent_preferences'
    expiry?: number; // Days, default: 365
    domain?: string;
    path?: string; // Default: '/'
  };

  /** How the visitor's country is found: see the Consent Jurisdictions guide */
  geoDetection?: GeoDetectionMode; // 'auto' (default) | 'cloudflare' | 'worker' | 'api' | 'always' | 'never'

  /** URL of a Worker geo endpoint (e.g. '/api/geo'), used by 'worker' and 'auto' */
  geoUrl?: string;

  /**
   * Jurisdictions whose visitors are asked for consent, decided from the country.
   * EEA: EU members (outermost regions and Åland included), IS, LI, NO. UK: GB. CH: Switzerland.
   * @default ["EEA", "UK"]
   */
  consentJurisdictions?: ConsentJurisdiction[]; // 'EEA' | 'UK' | 'CH'

  /**
   * A failed geo lookup: 'require-consent' asks the visitor (a choice stored outside
   * consent jurisdictions is asked again too); 'grant' treats them as outside.
   * @default 'require-consent'
   */
  geoFailure?: "require-consent" | "grant";

  /** Custom geo-detection provider */
  geoDetector?: GeoDetector;

  /**
   * Whether to send automatic page_view on GA initialization.
   * Set to false for Vue Router SPA apps where you track navigation
   * manually via trackPageView().
   * VitePress's enhanceWithConsent and Quasar's consentBoot set this
   * to false automatically — no manual configuration needed.
   * @default true
   */
  sendPageView?: boolean;

  /**
   * Google tag configuration for gaId, sent once after the consent default
   * and before the tag loads (in basic mode, once analytics is allowed).
   */
  googleAnalytics?: GoogleAnalyticsOptions;

  /**
   * 'advanced': gtag.js loads for every visitor with denied defaults;
   * Google receives cookieless pings before any choice and after a refusal.
   * 'basic': nothing reaches Google until the visitor allows analytics;
   * a grant implied by the jurisdiction does not count, and withdrawing
   * analytics switches a loaded tag off and deletes the _ga cookies.
   * Requires gaId: the manager loads the tag (the constructor throws without it).
   * @default 'advanced'
   */
  consentMode?: "advanced" | "basic";

  /**
   * Basic mode: reload the page when analytics is withdrawn after the
   * Google tag loaded, so products linked to that tag (Google Ads,
   * Floodlight) stop too; the choice is saved first.
   * @default false
   */
  reloadOnWithdrawal?: boolean;

  /**
   * Called when gtag.js fails to load (an ad blocker, a network error).
   * The banner still shows and choices are still saved; the next consent
   * change retries the load.
   */
  onGoogleAnalyticsError?: (error: unknown) => void;

  /**
   * Remote consent storage: a copy of the choice kept on a server. The consent cookie still
   * holds the choice; a grant of analytics or marketing also sets consent_uid, naming the
   * remote record. createKVStorage('/api/consent') for the Cloudflare KV Worker, or your own.
   */
  storage?: ConsentStorage;

  /** Consent version (changing resets consent) */
  version?: string;

  /** Callback when consent changes (also for a choice made in another tab, in basic mode) */
  onConsentChange?: (consent: StoredConsent) => void;

  /** Callback when banner is shown */
  onBannerShow?: () => void;

  /** Callback when banner is hidden */
  onBannerHide?: () => void;

  /** Callback when the preference centre opens */
  onPreferenceCenterShow?: () => void;

  /** Callback when the preference centre closes */
  onPreferenceCenterHide?: () => void;

  /** CCPA mode: visitors in covered US states see no banner but can opt out ("Do Not Sell") */
  ccpaEnabled?: boolean; // Default: false

  /** Your "Do Not Sell My Personal Information" link text; the library renders no link */
  doNotSellText?: string;

  /** Callback when the visitor is detected in a CCPA-covered state */
  onCCPAUser?: () => void;
}
```

## GeoDetectionMode

```typescript
type GeoDetectionMode =
  | "auto" // Cloudflare header, then Worker (with geoUrl), then IP API, then time zone
  | "cloudflare" // only the Cloudflare header
  | "worker" // only the Worker at geoUrl
  | "api" // only the IP API (ipapi.co)
  | "always" // ask every visitor
  | "never"; // ask no visitor
```

## ConsentRequest

What `requestConsent()` asks, for a custom preference centre to show (`manager.getConsentRequest()`).

```typescript
interface ConsentRequestOptions {
  /** Why the feature needs the category: your own text, in the visitor's language */
  reason?: string;
}

interface ConsentRequest {
  /** The categories asked for, in display order */
  categories: OptionalCategory[];
  /** The distinct reasons, in the order asked */
  reasons: string[];
}
```

## Other Types

```typescript
type OptionalCategory = "analytics" | "marketing" | "functional";
type ConsentJurisdiction = "EEA" | "UK" | "CH";
type ConsentTheme = "auto" | "light" | "dark";
type SupportedLocale = "bg" | "cs" | "da" | "de" | "el" | "en" | "es" | "et" | "fi" | "fr" | "ga"
  | "hr" | "hu" | "is" | "it" | "ja" | "ko" | "lt" | "lv" | "mt" | "nb" | "nl" | "pl" | "pt"
  | "ro" | "ru" | "sk" | "sl" | "sv" | "uk" | "zh";
```

## GoogleAnalyticsOptions

```typescript
interface GoogleAnalyticsOptions {
  /** Fields of the gtag('config', gaId, ...) call; a config the page's own snippet queued for gaId is kept */
  config?: GoogleAnalyticsConfigFields;
  /** Custom parameters merged into the config call; documented names are rejected here */
  customParameters?: Record<string, unknown>;
  /** Fields of gtag('set', ...), ahead of queued measurement commands; they apply to every Google tag */
  set?: GoogleAnalyticsFields;
  /** gtag('set', 'ads_data_redaction', ...): strip ad click IDs while ad_storage is denied */
  adsDataRedaction?: boolean;
  /** gtag('set', 'url_passthrough', ...): carry click IDs in link URLs while consent is denied */
  urlPassthrough?: boolean;
}

/** Fields Google documents for both set and config */
interface GoogleAnalyticsFields {
  allow_google_signals?: boolean;
  allow_ad_personalization_signals?: boolean;
  campaign_content?: string;
  campaign_id?: string;
  campaign_medium?: string;
  campaign_name?: string;
  campaign_source?: string;
  campaign_term?: string;
  client_id?: string;
  content_group?: string;
  cookie_domain?: string; // 'auto' (default), 'none' or a domain
  cookie_expires?: number; // seconds; 0 = session cookies
  cookie_flags?: string; // e.g. 'SameSite=None;Secure'
  cookie_path?: string;
  cookie_prefix?: string;
  cookie_update?: boolean;
  ignore_referrer?: boolean;
  language?: string;
  page_location?: string;
  page_referrer?: string;
  page_title?: string;
  screen_resolution?: string; // e.g. '800x600'
  user_id?: string;
  user_properties?: Record<string, string | number>;
}

interface GoogleAnalyticsConfigFields extends GoogleAnalyticsFields {
  /** Only true: Google keeps debug mode on for false as well */
  debug_mode?: true;
}
```

`send_page_view` is not a field here: `sendPageView` sets it, and the SPA integrations turn it off.

## ConsentCategories

```typescript
interface ConsentCategories {
  /** Analytics cookies (e.g., Google Analytics) */
  analytics: boolean;
  /** Marketing/advertising cookies */
  marketing: boolean;
  /** Functional cookies (preferences, etc.) */
  functional: boolean;
  /** Strictly necessary cookies (always true) */
  necessary: true;
}
```

## StoredConsent

```typescript
interface StoredConsent {
  /** Consent categories */
  categories: Omit<ConsentCategories, "necessary">;
  /** Timestamp when consent was given */
  timestamp: number;
  /** Version of the consent configuration */
  version: string;
  /** Whether the choice was made in a consent jurisdiction; such a choice stands wherever the visitor goes */
  consentRequired?: boolean;
}
```

## BannerConfig

```typescript
interface BannerConfig {
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
```

## PreferenceCenterConfig

```typescript
interface PreferenceCenterConfig {
  title: string;
  description: string;
  savePreferences: string;
  acceptAll: string;
  /** The banner's "Reject all" text when omitted */
  rejectAll?: string;
  /** Name and description per category */
  categories: {
    necessary: Partial<CategoryDisplayConfig>;
    analytics: Partial<CategoryDisplayConfig>;
    marketing: Partial<CategoryDisplayConfig>;
    functional: Partial<CategoryDisplayConfig>;
  };
}

interface CategoryDisplayConfig {
  name: string;
  description: string;
}
```

## GoogleConsentSignals

```typescript
interface GoogleConsentSignals {
  /** Controls Google Analytics cookies */
  analytics_storage: "granted" | "denied";
  /** Controls advertising cookies */
  ad_storage: "granted" | "denied";
  /** Controls whether user data can be sent to Google for ads */
  ad_user_data: "granted" | "denied";
  /** Controls personalized advertising */
  ad_personalization: "granted" | "denied";
}
```

## GeoDetector

```typescript
interface GeoDetector {
  /** Detect the visitor's country and whether it requires consent; throw when unknown */
  detect(): Promise<GeoDetectionResult>;
}

interface GeoDetectionResult {
  /**
   * Whether the visitor is in a consent jurisdiction. With countryCode set the manager
   * decides from the country and consentJurisdictions instead.
   */
  consentRequired: boolean;
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode?: string;
  /** Region/state (e.g. "California") */
  region?: string;
  /** Detection method used; 'stored': no lookup, the stored choice's jurisdiction */
  method: "cloudflare" | "worker" | "api" | "fallback" | "manual" | "stored";
}
```

`StoredConsent.consentRequired` records whether the choice was made in a consent jurisdiction. Consent cookies written by earlier versions carry the same flag as `isEU` and are read as `consentRequired`.

## Built-in Geo Detectors

```typescript
import {
  CloudflareGeoDetector,
  WorkerGeoDetector,
  IPAPIGeoDetector,
  TimezoneGeoDetector,
  AutoGeoDetector,
  createGeoDetector,
} from "@structured-world/vue-privacy";

// Use a specific detector
const detector = new CloudflareGeoDetector();
const result = await detector.detect();

// Or the one a GeoDetectionMode names
const worker = createGeoDetector("worker", "/api/geo");
```

## GA4 Event Types

Types for Google Analytics 4 event tracking.

### GA4Item

Product/item object for ecommerce events. Full interface matching [GA4 spec](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).

```typescript
interface GA4Item {
  /** SKU or product ID (required if item_name not provided) */
  item_id?: string;
  /** Product name (required if item_id not provided) */
  item_name?: string;
  /** Unit price */
  price?: number;
  /** Quantity */
  quantity?: number;
  /** Affiliate or partner name */
  affiliation?: string;
  /** Brand name */
  item_brand?: string;
  /** Primary category */
  item_category?: string;
  /** Category hierarchy levels 2-5 */
  item_category2?: string;
  item_category3?: string;
  item_category4?: string;
  item_category5?: string;
  /** Variant (size, color) */
  item_variant?: string;
  /** Coupon code */
  coupon?: string;
  /** Discount amount */
  discount?: number;
  /** Position in list */
  index?: number;
  /** List ID */
  item_list_id?: string;
  /** List name */
  item_list_name?: string;
  /** Google Business location ID */
  location_id?: string;
}
```

### GA4EcommerceParams

Parameters for ecommerce events (add_to_cart, begin_checkout, view_item, etc.)

```typescript
interface GA4EcommerceParams {
  /** 3-letter ISO 4217 currency code (e.g., 'USD', 'EUR') */
  currency: string;
  /** Monetary value */
  value: number;
  /** Array of items (max 200) */
  items: GA4Item[];
  /** Coupon code */
  coupon?: string;
}
```

### GA4PurchaseParams

Parameters for purchase event.

```typescript
interface GA4PurchaseParams extends GA4EcommerceParams {
  /** Unique transaction ID (required) */
  transaction_id: string;
  /** Shipping cost */
  shipping?: number;
  /** Tax amount */
  tax?: number;
  /** Customer type */
  customer_type?: "new" | "returning";
}
```

### GA4GenerateLeadParams

Parameters for generate_lead event.

```typescript
interface GA4GenerateLeadParams {
  /** Monetary value of the lead */
  value?: number;
  /** Currency code */
  currency?: string;
  /** Lead source */
  lead_source?: string;
}
```

### GA4RouteMeta

Route meta fields for Vue Router auto-tracking.

```typescript
interface GA4RouteMeta {
  /** Custom page title for GA4 page_view event */
  ga4Title?: string;
  /** GA4 event to fire on navigation */
  ga4Event?: {
    name: string;
    params?: Record<string, unknown>;
  };
}
```

### Usage Example

```typescript
import type {
  GA4Item,
  GA4EcommerceParams,
  GA4PurchaseParams,
  GA4RouteMeta,
} from "@structured-world/vue-privacy";

// Type your cart items
const cartItems: GA4Item[] = [{ item_id: "SKU_1", item_name: "Widget", price: 9.99, quantity: 2 }];

// Type your purchase params
const purchaseData: GA4PurchaseParams = {
  transaction_id: "ORDER_123",
  currency: "USD",
  value: 19.98,
  items: cartItems,
};

manager.trackPurchase(purchaseData);
```
