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
  method: "cloudflare" | "api" | "fallback" | "manual";
}

/**
 * Geo-detection provider interface
 */
export interface GeoDetector {
  /** Detect if user is in the EU */
  detect(): Promise<GeoDetectionResult>;
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
 * Main plugin configuration
 */
export interface ConsentConfig {
  /** Google Analytics measurement ID (G-XXXXXXXXXX) */
  gaId?: string;

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
   * - 'auto': Try Cloudflare header, fallback to IP API
   * - 'cloudflare': Only use Cloudflare header
   * - 'api': Only use IP API
   * - 'always': Always show banner (treat all as EU)
   * - 'never': Never show banner (treat all as non-EU)
   */
  euDetection?: "auto" | "cloudflare" | "api" | "always" | "never";

  /** Custom geo-detection provider */
  geoDetector?: GeoDetector;

  /**
   * Whether to send automatic page_view on GA initialization.
   * Set to false for SPA apps (VitePress, Vue Router) where you track navigation manually.
   * @default true
   */
  sendPageView?: boolean;

  /** Consent version (changing this resets consent for all users) */
  version?: string;

  /** Callback when consent changes */
  onConsentChange?: (consent: StoredConsent) => void;

  /** Callback when banner is shown */
  onBannerShow?: () => void;

  /** Callback when banner is hidden */
  onBannerHide?: () => void;
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
  euDetection: "auto" | "cloudflare" | "api" | "always" | "never";
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
