/**
 * Translatable string keys for consent banner
 */
export interface BannerTranslations {
  title: string;
  message: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  privacyLinkText: string;
}

/**
 * Translatable string keys for a single consent category
 */
export interface CategoryTranslations {
  name: string;
  description: string;
}

/**
 * Translatable string keys for preference center modal
 */
export interface PreferenceCenterTranslations {
  title: string;
  description: string;
  savePreferences: string;
  acceptAll: string;
  /** "Reject all" button text; the banner's `rejectAll` when omitted. */
  rejectAll?: string;
  categories: {
    necessary: CategoryTranslations;
    analytics: CategoryTranslations;
    marketing: CategoryTranslations;
    functional: CategoryTranslations;
  };
}

/**
 * Translatable string keys for CCPA compliance.
 *
 * Note: CCPA text is intentionally NOT translated to local languages.
 * "Do Not Sell My Personal Information" is the legally required phrase
 * under California Consumer Privacy Act. CCPA only applies to US states,
 * where English is the primary language. Translating this legal phrase
 * could cause compliance issues.
 */
export interface CCPATranslations {
  /** "Do Not Sell My Personal Information" link text (English only, legally required phrase) */
  doNotSell: string;
}

/**
 * Complete translation bundle for a single locale
 */
export interface Translations {
  banner: BannerTranslations;
  preferenceCenter: PreferenceCenterTranslations;
  ccpa: CCPATranslations;
}

/**
 * Supported locale codes: every official EU language, the EEA's Norwegian (Bokmål) and
 * Icelandic, and Russian, Ukrainian, Japanese, Chinese and Korean
 */
export type SupportedLocale =
  | "bg"
  | "cs"
  | "da"
  | "de"
  | "el"
  | "en"
  | "es"
  | "et"
  | "fi"
  | "fr"
  | "ga"
  | "hr"
  | "hu"
  | "is"
  | "it"
  | "ja"
  | "ko"
  | "lt"
  | "lv"
  | "mt"
  | "nb"
  | "nl"
  | "pl"
  | "pt"
  | "ro"
  | "ru"
  | "sk"
  | "sl"
  | "sv"
  | "uk"
  | "zh";
