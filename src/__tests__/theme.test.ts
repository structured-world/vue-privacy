// @vitest-environment jsdom
// A site with a light-only design pins the consent dialog to the light palette: the system's
// dark preference applies under theme 'auto' only, and 'dark' pins the dark palette.
import { describe, it, expect, afterEach } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createConsentManager } from "../core/consent-manager";
import type { ConsentConfig } from "../core/types";
import { createBanner, BANNER_CSS } from "../vanilla/banner";
import { createModal, MODAL_CSS } from "../vanilla/modal";
import ConsentBanner from "../vue/ConsentBanner.vue";
import ConsentPreferenceModal from "../vue/ConsentPreferenceModal.vue";
import { consentBannerCSS } from "../vue/banner-styles";
import { consentModalCSS } from "../vue/modal-styles";
import { customProperties } from "./helpers/palette";

const LIGHT_BG = "#ffffff";
const DARK_BG = "#1a1a1a";

/**
 * The background the stylesheet resolves for `el`: its variable, else the light default, as a
 * six-digit hex colour (the minified stylesheets write `#fff`).
 */
function background(css: string, el: Element, variable: string, prefersDark: boolean): string {
  const value = customProperties(css, el, prefersDark)[variable] ?? LIGHT_BG;
  return /^#[0-9a-f]{3}$/i.test(value) ? value.replace(/[0-9a-f]/gi, (d) => d + d) : value;
}

type Theme = NonNullable<ConsentConfig["theme"]>;

/** The Vue banner and preference centre, open, under the given config theme and props. */
async function mountVue(config: ConsentConfig, props: { theme?: Theme } = {}) {
  const manager = createConsentManager({ ...config, euDetection: "never" });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () => [h(ConsentBanner, props), h(ConsentPreferenceModal, props)],
  });
  app.provide("consentManager", manager);
  app.mount(host);
  manager.resetConsent();
  manager.showPreferenceCenter();
  await nextTick();
  const banner = document.querySelector(".consent-banner") as HTMLElement;
  const overlay = document.querySelector(".consent-modal-overlay") as HTMLElement;
  return { banner, overlay, unmount: () => app.unmount() };
}

describe("theme", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("Vue components", () => {
    it.each<[Theme | undefined, boolean, string]>([
      ["light", true, LIGHT_BG],
      ["light", false, LIGHT_BG],
      ["dark", false, DARK_BG],
      ["dark", true, DARK_BG],
      ["auto", true, DARK_BG],
      ["auto", false, LIGHT_BG],
      [undefined, true, DARK_BG],
      [undefined, false, LIGHT_BG],
    ])("theme %s, system dark %s: banner and dialog on %s", async (theme, prefersDark, bg) => {
      const { banner, overlay, unmount } = await mountVue({ theme });

      expect(background(consentBannerCSS, banner, "--consent-bg", prefersDark)).toBe(bg);
      // The dialog reads the variables its overlay sets.
      expect(background(consentModalCSS, overlay, "--consent-modal-bg", prefersDark)).toBe(bg);
      unmount();
    });

    it("a component's theme prop outranks the site config", async () => {
      const { banner, overlay, unmount } = await mountVue({ theme: "dark" }, { theme: "light" });

      expect(background(consentBannerCSS, banner, "--consent-bg", true)).toBe(LIGHT_BG);
      expect(background(consentModalCSS, overlay, "--consent-modal-bg", true)).toBe(LIGHT_BG);
      unmount();
    });
  });

  describe("vanilla components", () => {
    it("follow the site config when given no theme of their own", () => {
      const manager = createConsentManager({ theme: "light", euDetection: "never" });
      const banner = createBanner({ manager });
      const modal = createModal({ manager });
      const bannerEl = document.querySelector(".consent-banner") as HTMLElement;
      const overlay = document.querySelector(".consent-modal-overlay") as HTMLElement;

      expect(background(BANNER_CSS, bannerEl, "--consent-bg", true)).toBe(LIGHT_BG);
      expect(background(MODAL_CSS, overlay, "--consent-modal-bg", true)).toBe(LIGHT_BG);
      banner.destroy();
      modal.destroy();
    });

    it("let their own theme option outrank the site config", () => {
      const manager = createConsentManager({ theme: "light", euDetection: "never" });
      const banner = createBanner({ manager, theme: "dark" });
      const bannerEl = document.querySelector(".consent-banner") as HTMLElement;

      expect(background(BANNER_CSS, bannerEl, "--consent-bg", false)).toBe(DARK_BG);
      banner.destroy();
    });

    it("keep following the system without a theme anywhere", () => {
      const manager = createConsentManager({ euDetection: "never" });
      const banner = createBanner({ manager });
      const bannerEl = document.querySelector(".consent-banner") as HTMLElement;

      expect(background(BANNER_CSS, bannerEl, "--consent-bg", true)).toBe(DARK_BG);
      expect(background(BANNER_CSS, bannerEl, "--consent-bg", false)).toBe(LIGHT_BG);
      banner.destroy();
    });
  });

  it("rejects a theme it does not know", () => {
    expect(() => createConsentManager({ theme: "sepia" as Theme })).toThrow(/theme/);
  });
});
