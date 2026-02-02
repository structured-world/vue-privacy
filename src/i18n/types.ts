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
  categories: {
    necessary: CategoryTranslations;
    analytics: CategoryTranslations;
    marketing: CategoryTranslations;
    functional: CategoryTranslations;
  };
}

/**
 * Complete translation bundle for a single locale
 */
export interface Translations {
  banner: BannerTranslations;
  preferenceCenter: PreferenceCenterTranslations;
}

/**
 * Supported locale codes
 */
export type SupportedLocale =
  | "en"
  | "de"
  | "fr"
  | "es"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "ru"
  | "uk"
  | "ja"
  | "zh"
  | "ko";
