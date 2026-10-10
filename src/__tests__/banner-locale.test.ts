// @vitest-environment jsdom
// The banner speaks the visitor's locale unless the site set its own text: the built-in English
// defaults must not stand in for a site setting and hide the translation.
import { describe, it, expect, afterEach } from "vitest";
import { createApp, nextTick } from "vue";
import { createConsentManager } from "../core/consent-manager";
import { createBanner } from "../vanilla/banner";
import { getTranslations } from "../i18n/index";
import ConsentBanner from "../vue/ConsentBanner.vue";

describe("banner text follows the locale", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("vanilla: a German visitor gets the German buttons", () => {
    const manager = createConsentManager({ locale: "de", geoDetection: "never" });
    const banner = createBanner({ manager });
    const de = getTranslations("de").banner;

    expect(document.querySelector(".consent-banner__btn--reject")?.textContent?.trim()).toBe(
      de.rejectAll
    );
    expect(document.querySelector(".consent-banner__btn--accept")?.textContent?.trim()).toBe(
      de.acceptAll
    );
    banner.destroy();
  });

  it("Vue: a German visitor gets the German buttons", async () => {
    const manager = createConsentManager({ locale: "de", geoDetection: "never" });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp(ConsentBanner);
    app.provide("consentManager", manager);
    app.mount(host);
    manager.resetConsent();
    await nextTick();

    expect(document.querySelector(".consent-banner__btn--reject")?.textContent?.trim()).toBe(
      getTranslations("de").banner.rejectAll
    );
    app.unmount();
  });

  it("getConfig() resolves every banner field in the visitor's locale", () => {
    // A custom UI built from getConfig() gets complete text, translated, and the default link.
    const de = getTranslations("de").banner;
    expect(createConsentManager({ locale: "de" }).getConfig().banner).toEqual({
      ...de,
      privacyLink: "/privacy",
    });
    expect(
      createConsentManager({ locale: "de", banner: { rejectAll: "Refuse" } }).getConfig().banner
    ).toEqual({ ...de, privacyLink: "/privacy", rejectAll: "Refuse" });
  });

  it("keeps a site's own banner text", () => {
    const manager = createConsentManager({
      locale: "de",
      geoDetection: "never",
      banner: { rejectAll: "Refuse" },
    });
    const banner = createBanner({ manager });

    expect(document.querySelector(".consent-banner__btn--reject")?.textContent?.trim()).toBe(
      "Refuse"
    );
    banner.destroy();
  });
});
