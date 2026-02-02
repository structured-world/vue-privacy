import type { Translations, SupportedLocale } from "./types";
import { en } from "./locales/en";
import { de } from "./locales/de";
import { fr } from "./locales/fr";
import { es } from "./locales/es";
import { it } from "./locales/it";
import { pt } from "./locales/pt";
import { nl } from "./locales/nl";
import { pl } from "./locales/pl";
import { ru } from "./locales/ru";
import { uk } from "./locales/uk";
import { ja } from "./locales/ja";
import { zh } from "./locales/zh";
import { ko } from "./locales/ko";

const translations: Record<SupportedLocale, Translations> = {
  en,
  de,
  fr,
  es,
  it,
  pt,
  nl,
  pl,
  ru,
  uk,
  ja,
  zh,
  ko,
};

/**
 * Detect locale from browser navigator.language.
 * Returns the matching SupportedLocale or "en" as fallback.
 */
export function detectLocale(): SupportedLocale {
  if (typeof navigator === "undefined") return "en";

  const langCode = navigator.language.toLowerCase().split("-")[0] as SupportedLocale;
  return translations[langCode] ? langCode : "en";
}

/**
 * Get translations for a given locale (defaults to detected locale)
 */
export function getTranslations(locale?: SupportedLocale): Translations {
  const resolved = locale ?? detectLocale();
  return translations[resolved] ?? translations.en;
}

/**
 * Deep-merge custom translation overrides with base locale translations
 */
export function mergeTranslations(
  locale: SupportedLocale,
  custom: Partial<Translations>
): Translations {
  const base = getTranslations(locale);

  return {
    banner: { ...base.banner, ...custom.banner },
    preferenceCenter: {
      title: custom.preferenceCenter?.title ?? base.preferenceCenter.title,
      description: custom.preferenceCenter?.description ?? base.preferenceCenter.description,
      savePreferences:
        custom.preferenceCenter?.savePreferences ?? base.preferenceCenter.savePreferences,
      acceptAll: custom.preferenceCenter?.acceptAll ?? base.preferenceCenter.acceptAll,
      categories: {
        necessary: {
          ...base.preferenceCenter.categories.necessary,
          ...custom.preferenceCenter?.categories?.necessary,
        },
        analytics: {
          ...base.preferenceCenter.categories.analytics,
          ...custom.preferenceCenter?.categories?.analytics,
        },
        marketing: {
          ...base.preferenceCenter.categories.marketing,
          ...custom.preferenceCenter?.categories?.marketing,
        },
        functional: {
          ...base.preferenceCenter.categories.functional,
          ...custom.preferenceCenter?.categories?.functional,
        },
      },
    },
  };
}

// Re-export types
export type {
  Translations,
  BannerTranslations,
  PreferenceCenterTranslations,
  CategoryTranslations,
  SupportedLocale,
} from "./types";
