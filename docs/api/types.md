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
   * Set to false for SPA apps (VitePress, Vue Router) where you track
   * navigation manually via trackPageView().
   * The VitePress enhanceWithConsent adapter sets this to false automatically.
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
