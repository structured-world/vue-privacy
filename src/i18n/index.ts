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
import { bg } from "./locales/bg";
import { cs } from "./locales/cs";
import { da } from "./locales/da";
import { el } from "./locales/el";
import { et } from "./locales/et";
import { fi } from "./locales/fi";
import { ga } from "./locales/ga";
import { hr } from "./locales/hr";
import { hu } from "./locales/hu";
import { is } from "./locales/is";
import { lt } from "./locales/lt";
import { lv } from "./locales/lv";
import { mt } from "./locales/mt";
import { nb } from "./locales/nb";
import { ro } from "./locales/ro";
import { sk } from "./locales/sk";
import { sl } from "./locales/sl";
import { sv } from "./locales/sv";

const translations: Record<SupportedLocale, Translations> = {
  bg,
  cs,
  da,
  de,
  el,
  en,
  es,
  et,
  fi,
  fr,
  ga,
  hr,
  hu,
  is,
  it,
  ja,
  ko,
  lt,
  lv,
  mt,
  nb,
  nl,
  pl,
  pt,
  ro,
  ru,
  sk,
  sl,
  sv,
  uk,
  zh,
};

/**
 * Language subtags read as a supported locale they do not name: Norwegian without a written
 * standard (`no`) and Nynorsk (`nn`) readers read Bokmål (`nb`).
 */
const LANGUAGE_ALIASES: Readonly<Record<string, SupportedLocale>> = { no: "nb", nn: "nb" };

/** Which locales a site offers, and which one it shows when the visitor reads none of them. */
export interface LocaleOptions {
  /** The locales to choose from; every built-in locale when omitted. */
  locales?: readonly SupportedLocale[];
  /** Shown when no language of the visitor is offered: "en" if offered, else the first locale. */
  fallbackLocale?: SupportedLocale;
}

/**
 * The first of the language tags (most preferred first) that names an offered locale, through its
 * language subtag, so regional tags (`ro-MD`, `sv-FI`) resolve to their language; the fallback
 * locale when none does.
 */
export function resolveLocale(
  tags: readonly string[],
  options: LocaleOptions = {}
): SupportedLocale {
  const { locales } = options;
  for (const tag of tags) {
    const langCode = tag.toLowerCase().split("-")[0];
    const locale = LANGUAGE_ALIASES[langCode] ?? langCode;
    // Own keys only: "constructor" or "toString" is no locale.
    if (!Object.hasOwn(translations, locale)) continue;
    if (!locales || locales.includes(locale as SupportedLocale)) return locale as SupportedLocale;
  }
  if (options.fallbackLocale) return options.fallbackLocale;
  return !locales || locales.includes("en") ? "en" : (locales[0] ?? "en");
}

/**
 * Detect the locale from the browser's preferred languages (`navigator.languages`, in order),
 * within the offered locales; see {@link resolveLocale}.
 */
export function detectLocale(options?: LocaleOptions): SupportedLocale {
  if (typeof navigator === "undefined") return resolveLocale([], options);
  // An empty list means the browser reports no preferences; navigator.language still names one.
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return resolveLocale(preferred.filter(Boolean), options);
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
      // Both buttons refuse the same thing: a custom banner label carries over to the modal.
      rejectAll:
        custom.preferenceCenter?.rejectAll ??
        custom.banner?.rejectAll ??
        base.preferenceCenter.rejectAll,
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
    ccpa: { ...base.ccpa, ...custom.ccpa },
  };
}

// Re-export types
export type {
  Translations,
  BannerTranslations,
  PreferenceCenterTranslations,
  CategoryTranslations,
  CCPATranslations,
  SupportedLocale,
} from "./types";
