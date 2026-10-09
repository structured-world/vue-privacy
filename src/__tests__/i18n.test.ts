/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { detectLocale, getTranslations, mergeTranslations } from "../i18n/index";
import type { SupportedLocale } from "../i18n/types";
import { preferLanguages } from "./helpers/languages";

describe("i18n", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectLocale", () => {
    it("detects locale from the browser's preferred language", () => {
      preferLanguages("de-DE");
      expect(detectLocale()).toBe("de");
    });

    it("falls back to en for unsupported locale", () => {
      preferLanguages("xx-XX");
      expect(detectLocale()).toBe("en");
    });

    it("handles language code without region", () => {
      preferLanguages("fr");
      expect(detectLocale()).toBe("fr");
    });

    it("does not take an inherited property name for a locale", () => {
      preferLanguages("constructor");
      expect(detectLocale()).toBe("en");
    });

    it("takes the first preferred language it has, not only the first one", () => {
      // A Swiss German reader lists gsw first and German next: German, not the English fallback.
      preferLanguages("gsw-CH", "de-CH", "en");
      expect(detectLocale()).toBe("de");
    });

    it("follows the order of preference", () => {
      preferLanguages("pl-PL", "de-DE");
      expect(detectLocale()).toBe("pl");
    });

    it("reads navigator.language when the browser lists no preferences", () => {
      vi.spyOn(navigator, "languages", "get").mockReturnValue([]);
      vi.spyOn(navigator, "language", "get").mockReturnValue("ro-RO");
      expect(detectLocale()).toBe("ro");
    });

    it("picks only among the locales the site offers", () => {
      preferLanguages("fr-FR", "de-DE", "en");
      expect(detectLocale({ locales: ["en", "de"] })).toBe("de");
    });

    it("falls back to the configured default when no preferred language is offered", () => {
      preferLanguages("fr-FR", "it");
      expect(detectLocale({ locales: ["en", "de"], fallbackLocale: "de" })).toBe("de");
      expect(detectLocale({ fallbackLocale: "ro" })).toBe("fr");
    });

    it("falls back to English when the site offers it and names no default", () => {
      preferLanguages("ja");
      expect(detectLocale({ locales: ["de", "en"] })).toBe("en");
    });

    it("renders on the server in the site's fallback, having no browser to ask", () => {
      vi.stubGlobal("navigator", undefined);
      try {
        expect(detectLocale()).toBe("en");
        expect(detectLocale({ locales: ["ro", "hu"] })).toBe("ro");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("falls back to the site's first locale when it offers no English", () => {
      // A Romanian-only site shows Romanian, not text in a language it does not offer.
      preferLanguages("ja");
      expect(detectLocale({ locales: ["ro", "hu"] })).toBe("ro");
    });

    it.each([
      ["ro-RO", "ro"],
      ["ro-MD", "ro"],
      ["nb-NO", "nb"],
      ["no", "nb"],
      ["nn-NO", "nb"],
      ["is-IS", "is"],
      ["ga-IE", "ga"],
      ["el-GR", "el"],
      ["sv-FI", "sv"],
      ["mt-MT", "mt"],
      ["BG", "bg"],
    ])("resolves the regional tag %s to %s", (tag, locale) => {
      // Visitors in every EU and EEA country get the banner in their own language. Norwegian
      // tags without a written standard (no) and Nynorsk (nn) read Bokmål.
      preferLanguages(tag);
      expect(detectLocale()).toBe(locale);
    });
  });

  describe("getTranslations", () => {
    it("returns English translations by default", () => {
      preferLanguages("en-US");
      const t = getTranslations();
      expect(t.banner.acceptAll).toBe("Accept All");
    });

    it("returns German translations for de locale", () => {
      const t = getTranslations("de");
      expect(t.banner.acceptAll).toBe("Alle akzeptieren");
    });

    it("returns Russian translations for ru locale", () => {
      const t = getTranslations("ru");
      expect(t.banner.acceptAll).toBe("Принять все");
    });

    it("falls back to English for unknown locale", () => {
      const t = getTranslations("xx" as SupportedLocale);
      expect(t.banner.acceptAll).toBe("Accept All");
    });
  });

  describe("all locales", () => {
    const locales: SupportedLocale[] = [
      "en",
      "de",
      "fr",
      "es",
      "it",
      "pt",
      "nl",
      "pl",
      "ru",
      "uk",
      "ja",
      "zh",
      "ko",
      // Every other official EU language, and the EEA's Norwegian and Icelandic
      "bg",
      "cs",
      "da",
      "el",
      "et",
      "fi",
      "ga",
      "hr",
      "hu",
      "lt",
      "lv",
      "mt",
      "ro",
      "sk",
      "sl",
      "sv",
      "nb",
      "is",
    ];

    /** Every leaf of a translation bundle as "path=value". */
    function leaves(value: unknown, path = ""): Array<[string, unknown]> {
      if (typeof value !== "object" || value === null) return [[path, value]];
      return Object.entries(value).flatMap(([key, child]) =>
        leaves(child, path ? `${path}.${key}` : key)
      );
    }

    it.each(locales)("locale '%s' has every key of en, each a non-empty string", (locale) => {
      // A missing key renders as undefined text in the banner; the type allows the optional
      // preferenceCenter.rejectAll to be left out, so the key set is checked at run time.
      const expected = leaves(getTranslations("en")).map(([path]) => path);
      const actual = leaves(getTranslations(locale));

      expect(actual.map(([path]) => path).sort()).toEqual(expected.sort());
      for (const [path, text] of actual) {
        expect({ path, text: typeof text === "string" && text.trim() !== "" }).toEqual({
          path,
          text: true,
        });
      }
    });

    it.each(locales.filter((locale) => locale !== "en"))(
      "locale '%s' is its own translation, not the English fallback",
      (locale) => {
        const t = getTranslations(locale);
        expect(t.banner.acceptAll).not.toBe(getTranslations("en").banner.acceptAll);
        expect(t.preferenceCenter.description).not.toBe(
          getTranslations("en").preferenceCenter.description
        );
      }
    );

    it("writes Romanian ș and ț with the comma below, not the cedilla", () => {
      // ş and ţ (cedilla) are a common encoding error in Romanian text; the standard letters are
      // ș and ț (U+0219, U+021B).
      const text = leaves(getTranslations("ro"))
        .map(([, value]) => value)
        .join(" ");
      expect(text).not.toMatch(/[şţŞŢ]/);
      expect(text).toMatch(/[șț]/);
    });

    it.each(locales)(
      "locale '%s' keeps the CCPA link in its legally required English",
      (locale) => {
        expect(getTranslations(locale).ccpa.doNotSell).toBe("Do Not Sell My Personal Information");
      }
    );

    it.each(locales)("locale '%s' has non-empty banner and preference center titles", (locale) => {
      const t = getTranslations(locale);
      expect(t.banner.title).toBeTruthy();
      expect(t.banner.message).toBeTruthy();
      expect(t.banner.acceptAll).toBeTruthy();
      expect(t.banner.rejectAll).toBeTruthy();
      expect(t.banner.customize).toBeTruthy();
      expect(t.preferenceCenter.title).toBeTruthy();
      expect(t.preferenceCenter.savePreferences).toBeTruthy();
      expect(t.preferenceCenter.categories.necessary.name).toBeTruthy();
      expect(t.preferenceCenter.categories.analytics.name).toBeTruthy();
      expect(t.preferenceCenter.categories.marketing.name).toBeTruthy();
      expect(t.preferenceCenter.categories.functional.name).toBeTruthy();
    });
  });

  describe("mergeTranslations", () => {
    it("overrides banner title while preserving other strings", () => {
      const merged = mergeTranslations("en", {
        banner: { title: "Custom Title" } as never,
      });
      expect(merged.banner.title).toBe("Custom Title");
      expect(merged.banner.acceptAll).toBe("Accept All");
    });

    it("overrides preference center category name", () => {
      const merged = mergeTranslations("en", {
        preferenceCenter: {
          categories: {
            analytics: { name: "Web Analytics" },
          },
        } as never,
      });
      expect(merged.preferenceCenter.categories.analytics.name).toBe("Web Analytics");
      expect(merged.preferenceCenter.categories.analytics.description).toBeTruthy();
    });

    it("preserves base translations for non-overridden fields", () => {
      const merged = mergeTranslations("de", {});
      expect(merged.banner.acceptAll).toBe("Alle akzeptieren");
    });
  });
});
