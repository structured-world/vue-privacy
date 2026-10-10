// @vitest-environment jsdom
// A site with a light-only design pins the consent dialog to the light palette: the system's
// dark preference applies under theme 'auto' only, and 'dark' pins the dark palette.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  const manager = createConsentManager({ ...config, geoDetection: "never" });
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
      const manager = createConsentManager({ theme: "light", geoDetection: "never" });
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
      const manager = createConsentManager({ theme: "light", geoDetection: "never" });
      const banner = createBanner({ manager, theme: "dark" });
      const bannerEl = document.querySelector(".consent-banner") as HTMLElement;

      expect(background(BANNER_CSS, bannerEl, "--consent-bg", false)).toBe(DARK_BG);
      banner.destroy();
    });

    it("keep following the system without a theme anywhere", () => {
      const manager = createConsentManager({ geoDetection: "never" });
      const banner = createBanner({ manager });
      const bannerEl = document.querySelector(".consent-banner") as HTMLElement;

      expect(background(BANNER_CSS, bannerEl, "--consent-bg", true)).toBe(DARK_BG);
      expect(background(BANNER_CSS, bannerEl, "--consent-bg", false)).toBe(LIGHT_BG);
      banner.destroy();
    });
  });

  describe("dark palettes keep links and outlined buttons readable", () => {
    // The privacy link, the customize button, the dialog's accept-all and reject-all buttons
    // and the focus outline take --consent-link; WCAG 2.1 SC 1.4.3 asks 4.5:1 for normal text.
    const DEFAULT_LINK = "#0066cc";

    /** WCAG 2.1 relative luminance of a six-digit hex colour. */
    function luminance(hex: string): number {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contrast(a: string, b: string): number {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    }

    function linkContrast(css: string, el: Element, bgVariable: string, prefersDark: boolean) {
      const vars = customProperties(css, el, prefersDark);
      return contrast(
        vars["--consent-link"] ?? DEFAULT_LINK,
        background(css, el, bgVariable, prefersDark)
      );
    }

    it.each<[Theme, boolean]>([
      ["dark", false],
      ["auto", true],
    ])("Vue, theme %s, system dark %s", async (theme, prefersDark) => {
      const { banner, overlay, unmount } = await mountVue({ theme });

      expect(
        linkContrast(consentBannerCSS, banner, "--consent-bg", prefersDark)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        linkContrast(consentModalCSS, overlay, "--consent-modal-bg", prefersDark)
      ).toBeGreaterThanOrEqual(4.5);
      unmount();
    });

    it.each<[Theme, boolean]>([
      ["dark", false],
      ["auto", true],
    ])("vanilla, theme %s, system dark %s, injected and CDN stylesheets", (theme, prefersDark) => {
      const manager = createConsentManager({ theme, geoDetection: "never" });
      const banner = createBanner({ manager });
      const modal = createModal({ manager });
      const bannerEl = document.querySelector(".consent-banner") as HTMLElement;
      const overlay = document.querySelector(".consent-modal-overlay") as HTMLElement;
      // The CDN files carry the same palettes as the injected strings, kept apart by hand.
      const cdnFile = (name: string) =>
        readFileSync(resolve(import.meta.dirname, "../vanilla", name), "utf8");

      for (const css of [BANNER_CSS, cdnFile("banner.css")]) {
        expect(linkContrast(css, bannerEl, "--consent-bg", prefersDark)).toBeGreaterThanOrEqual(
          4.5
        );
      }
      for (const css of [MODAL_CSS, cdnFile("modal.css")]) {
        expect(
          linkContrast(css, overlay, "--consent-modal-bg", prefersDark)
        ).toBeGreaterThanOrEqual(4.5);
      }
      banner.destroy();
      modal.destroy();
    });
  });

  it("rejects a theme it does not know", () => {
    expect(() => createConsentManager({ theme: "sepia" as Theme })).toThrow(/theme/);
  });
});
