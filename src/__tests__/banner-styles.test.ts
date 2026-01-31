// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { injectBannerStyles } from "../vue/banner-styles";

const STYLE_ID = "vue-privacy-consent-banner";

describe("injectBannerStyles", () => {
  beforeEach(() => {
    // Clean up any injected style between tests
    document.getElementById(STYLE_ID)?.remove();
  });

  it("appends a <style> element with the correct id", () => {
    injectBannerStyles();
    const el = document.getElementById(STYLE_ID);
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("STYLE");
    expect(el!.textContent).toContain(".consent-banner");
  });

  it("does not duplicate when called multiple times", () => {
    injectBannerStyles();
    injectBannerStyles();
    injectBannerStyles();
    const elements = document.querySelectorAll(`#${STYLE_ID}`);
    expect(elements.length).toBe(1);
  });

  it("re-injects if the style element was removed externally", () => {
    injectBannerStyles();
    document.getElementById(STYLE_ID)!.remove();
    expect(document.getElementById(STYLE_ID)).toBeNull();

    injectBannerStyles();
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
  });
});
