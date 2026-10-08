// @vitest-environment jsdom
// Refusing consent is as easy and as visible as accepting it (EDPB Cookie Banner Taskforce
// report, January 2023, points 9-14): the banner's two buttons look the same by default, and both
// preference centres offer "Reject all" beside "Accept all".
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp, nextTick } from "vue";
import { consentBannerCSS } from "../vue/banner-styles";
import { consentModalCSS } from "../vue/modal-styles";
import { BANNER_CSS as VANILLA_BANNER_CSS } from "../vanilla/banner";
import { MODAL_CSS as VANILLA_MODAL_CSS, createModal } from "../vanilla/modal";
import { getTranslations } from "../i18n/index";
import type { SupportedLocale } from "../i18n/types";
import { createConsentManager } from "../core/consent-manager";
import ConsentPreferenceModal from "../vue/ConsentPreferenceModal.vue";

const LOCALES: SupportedLocale[] = [
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

// Read from the project root (vitest's working directory): jsdom gives import.meta.url no file URL.
const VANILLA_BANNER_FILE = readFileSync(join(process.cwd(), "src/vanilla/banner.css"), "utf8");
const VANILLA_MODAL_FILE = readFileSync(join(process.cwd(), "src/vanilla/modal.css"), "utf8");

/** Declarations of the first rule whose selector list contains `selector`. */
function declarations(css: string, selector: string): Map<string, string> {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  for (let match = rule.exec(flat); match; match = rule.exec(flat)) {
    const selectors = match[1].split(",").map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    const result = new Map<string, string>();
    for (const part of match[2].split(";")) {
      const colon = part.indexOf(":");
      if (colon < 0) continue;
      result.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
    }
    return result;
  }
  throw new Error(`no rule for ${selector}`);
}

/** Custom properties every theme block of the stylesheet defines. */
function themeVariables(css: string): string[] {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return Array.from(flat.matchAll(/(--consent-[a-z-]+)\s*:/g), (m) => m[1]);
}

/** Resolve var(--name, fallback) against the default theme (`:root`). */
function resolve(value: string, theme: Map<string, string>): string {
  const ref = /^var\(\s*(--[a-z-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(value.trim());
  if (!ref) return value.trim();
  const defined = theme.get(ref[1]);
  if (defined !== undefined) return resolve(defined, theme);
  return ref[2] === undefined ? "" : resolve(ref[2], theme);
}

function rootTheme(css: string): Map<string, string> {
  try {
    return declarations(css, ":root");
  } catch {
    return new Map();
  }
}

describe("banner buttons look the same by default", () => {
  const stylesheets: [string, string][] = [
    ["Vue banner", consentBannerCSS],
    ["vanilla banner (inline)", VANILLA_BANNER_CSS],
    ["vanilla banner (banner.css)", VANILLA_BANNER_FILE],
  ];

  for (const [name, css] of stylesheets) {
    it(`${name}: "Reject all" resolves to the colours of "Accept all"`, () => {
      const theme = rootTheme(css);
      const accept = declarations(css, ".consent-banner__btn--accept");
      const reject = declarations(css, ".consent-banner__btn--reject");

      expect(resolve(reject.get("background") ?? "", theme)).toBe(
        resolve(accept.get("background") ?? "", theme)
      );
      expect(resolve(reject.get("color") ?? "", theme)).toBe(
        resolve(accept.get("color") ?? "", theme)
      );
    });

    it(`${name}: no theme gives "Reject all" colours of its own`, () => {
      // A site that sets --consent-btn-reject-* still gets its own colours; the library's light
      // and dark themes do not, so the default stays equal in both.
      expect(themeVariables(css)).not.toContain("--consent-btn-reject-bg");
      expect(themeVariables(css)).not.toContain("--consent-btn-reject-text");
    });
  }

  it("sizes and weighs both banner buttons by the shared class only", () => {
    for (const css of [consentBannerCSS, VANILLA_BANNER_CSS, VANILLA_BANNER_FILE]) {
      for (const button of [".consent-banner__btn--accept", ".consent-banner__btn--reject"]) {
        const own = declarations(css, button);
        for (const property of ["padding", "font-size", "font-weight", "border", "width"]) {
          expect(own.has(property)).toBe(false);
        }
      }
    }
  });
});

describe("preference centre styles", () => {
  for (const [name, css] of [
    ["Vue", consentModalCSS],
    ["vanilla (inline)", VANILLA_MODAL_CSS],
    ["vanilla (modal.css)", VANILLA_MODAL_FILE],
  ] as const) {
    it(`${name}: "Reject all" is styled exactly as "Accept all"`, () => {
      expect(declarations(css, ".consent-modal__btn--reject-all")).toEqual(
        declarations(css, ".consent-modal__btn--accept-all")
      );
    });
  }
});

describe("translations", () => {
  it.each(LOCALES)("%s has a preference-centre 'Reject all' string", (locale) => {
    const t = getTranslations(locale);
    expect(t.preferenceCenter.rejectAll).toBe(t.banner.rejectAll);
    expect(t.preferenceCenter.rejectAll).toBeTruthy();
  });
});

describe("'Reject all' in the preference centre", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("vanilla: refuses every optional category and closes", async () => {
    const manager = createConsentManager({ euDetection: "never" });
    await manager.acceptAll();
    const modal = createModal({ manager });
    manager.showPreferenceCenter();

    const button = document.querySelector<HTMLButtonElement>(".consent-modal__btn--reject-all");
    expect(button?.textContent?.trim()).toBe(getTranslations(manager.getLocale()).banner.rejectAll);
    button!.click();
    await nextTick();

    expect(manager.getConsent()?.categories).toEqual({
      analytics: false,
      marketing: false,
      functional: false,
    });
    expect(modal.isVisible()).toBe(false);
    modal.destroy();
  });

  it("Vue: refuses every optional category and closes", async () => {
    const manager = createConsentManager({ euDetection: "never" });
    await manager.acceptAll();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp(ConsentPreferenceModal);
    app.provide("consentManager", manager);
    app.mount(host);
    manager.showPreferenceCenter();
    await nextTick();

    const button = document.querySelector<HTMLButtonElement>(".consent-modal__btn--reject-all");
    expect(button?.textContent?.trim()).toBe(getTranslations(manager.getLocale()).banner.rejectAll);
    button!.click();
    await nextTick();

    expect(manager.getConsent()?.categories).toEqual({
      analytics: false,
      marketing: false,
      functional: false,
    });
    // Closing: <Transition> plays the leave animation (which jsdom never finishes) on a hidden
    // dialog, while an open one carries no leave class.
    const overlay = document.querySelector(".consent-modal-overlay");
    expect(overlay === null || overlay.classList.contains("consent-modal-leave-active")).toBe(true);
    app.unmount();
  });
});
