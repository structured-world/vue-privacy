/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { detectLocale, getTranslations, mergeTranslations } from "../i18n/index";
import type { SupportedLocale } from "../i18n/types";

describe("i18n", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectLocale", () => {
    it("detects locale from navigator.language", () => {
      vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
      expect(detectLocale()).toBe("de");
    });

    it("falls back to en for unsupported locale", () => {
      vi.spyOn(navigator, "language", "get").mockReturnValue("xx-XX");
      expect(detectLocale()).toBe("en");
    });

    it("handles language code without region", () => {
      vi.spyOn(navigator, "language", "get").mockReturnValue("fr");
      expect(detectLocale()).toBe("fr");
    });
  });

  describe("getTranslations", () => {
    it("returns English translations by default", () => {
      vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
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
    ];

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
