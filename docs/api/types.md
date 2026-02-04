# TypeScript Types

## ConsentConfig

Main configuration interface.

```typescript
interface ConsentConfig {
  /** Google Analytics measurement ID (G-XXXXXXXXXX) */
  gaId?: string;

  /** Consent categories to manage */
  categories?: Partial<Omit<ConsentCategories, 'necessary'>>;

  /** Banner UI configuration */
  banner?: Partial<BannerConfig>;

  /** Cookie configuration */
  cookie?: {
    name?: string;    // Default: 'consent_preferences'
    expiry?: number;  // Days, default: 365
    domain?: string;
    path?: string;    // Default: '/'
  };

  /** EU detection mode */
  euDetection?: 'auto' | 'cloudflare' | 'api' | 'always' | 'never';

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

  /** Consent version (changing resets consent) */
  version?: string;

  /** Callback when consent changes */
  onConsentChange?: (consent: StoredConsent) => void;

  /** Callback when banner is shown */
  onBannerShow?: () => void;

  /** Callback when banner is hidden */
  onBannerHide?: () => void;
}
```

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
  categories: Omit<ConsentCategories, 'necessary'>;
  /** Timestamp when consent was given */
  timestamp: number;
  /** Version of the consent configuration */
  version: string;
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

## GoogleConsentSignals

```typescript
interface GoogleConsentSignals {
  /** Controls Google Analytics cookies */
  analytics_storage: 'granted' | 'denied';
  /** Controls advertising cookies */
  ad_storage: 'granted' | 'denied';
  /** Controls whether user data can be sent to Google for ads */
  ad_user_data: 'granted' | 'denied';
  /** Controls personalized advertising */
  ad_personalization: 'granted' | 'denied';
}
```

## GeoDetector

```typescript
interface GeoDetector {
  /** Detect if user is in the EU */
  detect(): Promise<GeoDetectionResult>;
}

interface GeoDetectionResult {
  /** Whether the user is in the EU */
  isEU: boolean;
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode?: string;
  /** Detection method used */
  method: 'cloudflare' | 'api' | 'fallback' | 'manual';
}
```

## Built-in Geo Detectors

```typescript
import {
  CloudflareGeoDetector,
  IPAPIGeoDetector,
  TimezoneGeoDetector,
  AutoGeoDetector,
} from '@structured-world/vue-privacy';

// Use a specific detector
const detector = new CloudflareGeoDetector();
const result = await detector.detect();
```

## GA4 Event Types

Types for Google Analytics 4 event tracking.

### GA4Item

Product/item object for ecommerce events. Full interface matching [GA4 spec](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).

```typescript
interface GA4Item {
  /** Required: SKU or product ID */
  item_id: string;
  /** Required: Product name */
  item_name: string;
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
  customer_type?: 'new' | 'returning';
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
} from '@structured-world/vue-privacy';

// Type your cart items
const cartItems: GA4Item[] = [
  { item_id: 'SKU_1', item_name: 'Widget', price: 9.99, quantity: 2 }
];

// Type your purchase params
const purchaseData: GA4PurchaseParams = {
  transaction_id: 'ORDER_123',
  currency: 'USD',
  value: 19.98,
  items: cartItems,
};

manager.trackPurchase(purchaseData);
```
