// @vitest-environment jsdom
// The site's language switcher changes the consent UI language without a reload, within the
// languages the site offers; the banner and the preference centre re-render in place.
import { describe, it, expect, afterEach, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createConsentManager } from "../core/consent-manager";
import { createBanner } from "../vanilla/banner";
import { createModal } from "../vanilla/modal";
import { getTranslations } from "../i18n/index";
import ConsentBanner from "../vue/ConsentBanner.vue";
import ConsentPreferenceModal from "../vue/ConsentPreferenceModal.vue";
import { preferLanguages } from "./helpers/languages";

const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();

describe("locale detection in the manager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects among the configured locales, with the configured fallback", () => {
    preferLanguages("fr-FR", "de-DE");
    expect(createConsentManager({ locales: ["en", "de"] }).getLocale()).toBe("de");
    preferLanguages("ja");
    expect(createConsentManager({ locales: ["ro", "en"], fallbackLocale: "ro" }).getLocale()).toBe(
      "ro"
    );
  });

  it("lets a forced locale stand", () => {
    preferLanguages("de-DE");
    expect(createConsentManager({ locale: "ro" }).getLocale()).toBe("ro");
  });

  it("rejects an empty locale list and a fallback the site does not offer", () => {
    expect(() => createConsentManager({ locales: [] })).toThrow(/locales/);
    expect(() => createConsentManager({ locales: ["en", "de"], fallbackLocale: "ro" })).toThrow(
      /fallbackLocale/
    );
  });
});

describe("setLocale", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("resolves a regional tag to its language and reports the change", () => {
    const manager = createConsentManager({ locale: "en" });
    const listener = vi.fn();
    manager.onLocaleChange(listener);

    expect(manager.setLocale("ro-MD")).toBe("ro");
    expect(manager.getLocale()).toBe("ro");
    expect(listener).toHaveBeenCalledExactlyOnceWith("ro");
  });

  it("does not report a switch to the language already shown", () => {
    const manager = createConsentManager({ locale: "de" });
    const listener = vi.fn();
    manager.onLocaleChange(listener);

    manager.setLocale("de-AT");
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps to the offered locales: an unoffered language gets the fallback", () => {
    const manager = createConsentManager({ locale: "de", locales: ["en", "de"] });
    expect(manager.setLocale("fr-FR")).toBe("en");
  });

  it("stops reporting to a listener that unsubscribed", () => {
    const manager = createConsentManager({ locale: "en" });
    const listener = vi.fn();
    const unsubscribe = manager.onLocaleChange(listener);

    unsubscribe();
    manager.setLocale("de");
    expect(listener).not.toHaveBeenCalled();
  });

  it("reports a switch to the listeners registered when it happened, exactly once each", () => {
    // A listener may (un)subscribe others while being notified, as a component that re-renders
    // and mounts or unmounts another one does.
    const manager = createConsentManager({ locale: "en" });
    const late = vi.fn();
    const second = vi.fn();
    let stopSecond = () => {};
    manager.onLocaleChange(() => {
      stopSecond();
      manager.onLocaleChange(late);
    });
    stopSecond = manager.onLocaleChange(second);

    manager.setLocale("de");
    expect(second).toHaveBeenCalledExactlyOnceWith("de");
    expect(late).not.toHaveBeenCalled();

    manager.setLocale("ro");
    expect(second).toHaveBeenCalledOnce();
    expect(late).toHaveBeenCalledExactlyOnceWith("ro");
  });

  it("keeps notifying the other listeners when one throws", () => {
    const manager = createConsentManager({ locale: "en" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const after = vi.fn();
    manager.onLocaleChange(() => {
      throw new Error("boom");
    });
    manager.onLocaleChange(after);

    manager.setLocale("de");
    expect(after).toHaveBeenCalledExactlyOnceWith("de");
    expect(error).toHaveBeenCalled();
  });

  it("re-resolves getConfig().banner in the new language, keeping the site's own text", () => {
    const manager = createConsentManager({ locale: "en", banner: { rejectAll: "Refuse" } });
    manager.setLocale("de");
    expect(manager.getConfig().banner).toEqual({
      ...getTranslations("de").banner,
      privacyLink: "/privacy",
      rejectAll: "Refuse",
    });
    expect(manager.getConfig().locale).toBe("de");
  });

  it("vanilla banner: re-renders in the new language", () => {
    const manager = createConsentManager({ locale: "en", geoDetection: "never" });
    const banner = createBanner({ manager });

    manager.setLocale("ro");
    const ro = getTranslations("ro").banner;
    expect(text(".consent-banner__title")).toBe(ro.title);
    expect(text(".consent-banner__btn--reject")).toBe(ro.rejectAll);
    expect(text(".consent-banner__btn--accept")).toBe(ro.acceptAll);

    banner.destroy();
    manager.setLocale("de");
    expect(document.querySelector(".consent-banner")).toBeNull();
  });

  it("vanilla banner: buttons still act after a re-render", async () => {
    const manager = createConsentManager({ locale: "en", geoDetection: "never" });
    const banner = createBanner({ manager });
    manager.setLocale("de");

    (document.querySelector(".consent-banner__btn--reject") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(manager.getConsent()?.categories.analytics).toBe(false));
    banner.destroy();
  });

  it("vanilla modal: re-renders in the new language and keeps the visitor's toggles", () => {
    const manager = createConsentManager({ locale: "en", geoDetection: "never" });
    const modal = createModal({ manager });
    manager.showPreferenceCenter();
    const analytics = () =>
      document.querySelector('[data-category="analytics"]') as HTMLInputElement;
    analytics().checked = true;

    manager.setLocale("ro");
    const ro = getTranslations("ro").preferenceCenter;
    expect(text(".consent-modal__title")).toBe(ro.title);
    expect(text(".consent-modal__btn--save")).toBe(ro.savePreferences);
    expect(analytics().checked).toBe(true);
    expect(modal.isVisible()).toBe(true);

    modal.destroy();
  });

  it("vanilla modal: saving after a re-render stores the toggles shown", async () => {
    const manager = createConsentManager({ locale: "en", geoDetection: "never" });
    const modal = createModal({ manager });
    manager.showPreferenceCenter();
    manager.setLocale("de");

    (document.querySelector('[data-category="analytics"]') as HTMLInputElement).checked = true;
    (document.querySelector(".consent-modal__btn--save") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(manager.getConsent()?.categories.analytics).toBe(true));
    modal.destroy();
  });

  it("Vue banner and preference centre re-render in the new language", async () => {
    const manager = createConsentManager({ locale: "en", geoDetection: "never" });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({ render: () => [h(ConsentBanner), h(ConsentPreferenceModal)] });
    app.provide("consentManager", manager);
    app.mount(host);
    manager.resetConsent();
    manager.showPreferenceCenter();
    await nextTick();

    manager.setLocale("ro");
    await nextTick();
    expect(text(".consent-banner__btn--reject")).toBe(getTranslations("ro").banner.rejectAll);
    expect(text(".consent-modal__title")).toBe(getTranslations("ro").preferenceCenter.title);

    app.unmount();
  });
});
