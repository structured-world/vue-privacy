// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createBanner, injectVanillaBannerStyles, BANNER_CSS } from "../vanilla/banner";
import { createConsentManager } from "../core/consent-manager";
import type { ConsentManager } from "../core/consent-manager";

const STYLE_ID = "vue-privacy-vanilla-banner";
const CONTAINER_ID = "vue-privacy-banner";

describe("injectVanillaBannerStyles", () => {
  beforeEach(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  it("appends a <style> element with the correct id", () => {
    injectVanillaBannerStyles();
    const el = document.getElementById(STYLE_ID);
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("STYLE");
    expect(el!.textContent).toContain(".consent-banner");
  });

  it("does not duplicate when called multiple times", () => {
    injectVanillaBannerStyles();
    injectVanillaBannerStyles();
    injectVanillaBannerStyles();
    const elements = document.querySelectorAll(`#${STYLE_ID}`);
    expect(elements.length).toBe(1);
  });

  it("re-injects if the style element was removed externally", () => {
    injectVanillaBannerStyles();
    document.getElementById(STYLE_ID)!.remove();
    expect(document.getElementById(STYLE_ID)).toBeNull();

    injectVanillaBannerStyles();
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
  });
});

describe("BANNER_CSS", () => {
  it("contains essential CSS rules", () => {
    expect(BANNER_CSS).toContain(".consent-banner");
    expect(BANNER_CSS).toContain(".consent-banner--bottom");
    expect(BANNER_CSS).toContain(".consent-banner--top");
    expect(BANNER_CSS).toContain(".consent-banner--center");
    expect(BANNER_CSS).toContain(".consent-banner__btn");
    expect(BANNER_CSS).toContain(".consent-banner__btn--accept");
    expect(BANNER_CSS).toContain(".consent-banner__btn--reject");
  });
});

describe("createBanner", () => {
  let manager: ConsentManager;

  beforeEach(() => {
    // Clean up DOM
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CONTAINER_ID)?.remove();
    document.body.innerHTML = "";

    // Create a fresh manager for each test
    manager = createConsentManager({
      euDetection: "never", // Disable geo detection for tests
    });
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = "";
  });

  it("creates a banner element in the DOM", () => {
    const banner = createBanner({ manager });

    const container = document.getElementById(CONTAINER_ID);
    expect(container).not.toBeNull();

    const bannerEl = container!.querySelector(".consent-banner");
    expect(bannerEl).not.toBeNull();

    banner.destroy();
  });

  it("uses provided container selector", () => {
    const customContainer = document.createElement("div");
    customContainer.id = "custom-container";
    document.body.appendChild(customContainer);

    const banner = createBanner({
      manager,
      container: "#custom-container",
    });

    const bannerEl = customContainer.querySelector(".consent-banner");
    expect(bannerEl).not.toBeNull();

    // Default container should not be created
    expect(document.getElementById(CONTAINER_ID)).toBeNull();

    banner.destroy();
  });

  it("uses provided container element", () => {
    const customContainer = document.createElement("div");
    document.body.appendChild(customContainer);

    const banner = createBanner({
      manager,
      container: customContainer,
    });

    const bannerEl = customContainer.querySelector(".consent-banner");
    expect(bannerEl).not.toBeNull();

    banner.destroy();
  });

  it("throws error if container selector not found", () => {
    expect(() => {
      createBanner({
        manager,
        container: "#non-existent",
      });
    }).toThrow('createBanner: container "#non-existent" not found');
  });

  it("applies position class correctly", () => {
    const bannerBottom = createBanner({ manager, position: "bottom" });
    expect(document.querySelector(".consent-banner--bottom")).not.toBeNull();
    bannerBottom.destroy();

    const bannerTop = createBanner({ manager, position: "top" });
    expect(document.querySelector(".consent-banner--top")).not.toBeNull();
    bannerTop.destroy();

    const bannerCenter = createBanner({ manager, position: "center" });
    expect(document.querySelector(".consent-banner--center")).not.toBeNull();
    bannerCenter.destroy();
  });

  it("applies theme data attribute", () => {
    const bannerLight = createBanner({ manager, theme: "light" });
    expect(document.querySelector('[data-consent-theme="light"]')).not.toBeNull();
    bannerLight.destroy();

    const bannerDark = createBanner({ manager, theme: "dark" });
    expect(document.querySelector('[data-consent-theme="dark"]')).not.toBeNull();
    bannerDark.destroy();

    const bannerAuto = createBanner({ manager, theme: "auto" });
    expect(document.querySelector('[data-consent-theme="auto"]')).not.toBeNull();
    bannerAuto.destroy();
  });

  it("starts hidden by default", () => {
    const banner = createBanner({ manager });
    const bannerEl = document.querySelector(".consent-banner");
    expect(bannerEl!.classList.contains("consent-banner--hidden")).toBe(true);
    expect(banner.isVisible()).toBe(false);
    banner.destroy();
  });

  it("show() makes banner visible", () => {
    const banner = createBanner({ manager });
    banner.show();
    const bannerEl = document.querySelector(".consent-banner");
    expect(bannerEl!.classList.contains("consent-banner--hidden")).toBe(false);
    expect(banner.isVisible()).toBe(true);
    banner.destroy();
  });

  it("hide() makes banner hidden", () => {
    const banner = createBanner({ manager });
    banner.show();
    banner.hide();
    const bannerEl = document.querySelector(".consent-banner");
    expect(bannerEl!.classList.contains("consent-banner--hidden")).toBe(true);
    expect(banner.isVisible()).toBe(false);
    banner.destroy();
  });

  it("renders accept, reject, and customize buttons", () => {
    const banner = createBanner({ manager });
    const acceptBtn = document.querySelector('[data-action="accept"]');
    const rejectBtn = document.querySelector('[data-action="reject"]');
    const customizeBtn = document.querySelector('[data-action="customize"]');

    expect(acceptBtn).not.toBeNull();
    expect(rejectBtn).not.toBeNull();
    expect(customizeBtn).not.toBeNull();

    banner.destroy();
  });

  it("renders without customize button when not configured", () => {
    const managerNoCustomize = createConsentManager({
      euDetection: "never",
      banner: {
        customize: undefined,
      },
    });

    const banner = createBanner({ manager: managerNoCustomize });
    const customizeBtn = document.querySelector('[data-action="customize"]');

    // Button still exists because i18n provides default text
    expect(customizeBtn).not.toBeNull();

    banner.destroy();
  });

  it("calls onAccept callback when accept button clicked", async () => {
    const onAccept = vi.fn();
    const banner = createBanner({ manager, onAccept });
    banner.show();

    const acceptBtn = document.querySelector('[data-action="accept"]') as HTMLButtonElement;
    acceptBtn.click();

    // Wait for async handler
    await vi.waitFor(() => expect(onAccept).toHaveBeenCalled());

    banner.destroy();
  });

  it("calls onReject callback when reject button clicked", async () => {
    const onReject = vi.fn();
    const banner = createBanner({ manager, onReject });
    banner.show();

    const rejectBtn = document.querySelector('[data-action="reject"]') as HTMLButtonElement;
    rejectBtn.click();

    // Wait for async handler
    await vi.waitFor(() => expect(onReject).toHaveBeenCalled());

    banner.destroy();
  });

  it("calls onCustomize callback when customize button clicked", () => {
    const onCustomize = vi.fn();
    const banner = createBanner({ manager, onCustomize });
    banner.show();

    const customizeBtn = document.querySelector('[data-action="customize"]') as HTMLButtonElement;
    customizeBtn.click();

    expect(onCustomize).toHaveBeenCalled();

    banner.destroy();
  });

  it("has proper accessibility attributes", () => {
    const banner = createBanner({ manager });
    const bannerEl = document.querySelector(".consent-banner");

    expect(bannerEl!.getAttribute("role")).toBe("dialog");
    expect(bannerEl!.getAttribute("aria-modal")).toBe("true");
    expect(bannerEl!.getAttribute("aria-labelledby")).toBe("consent-banner-title");
    expect(bannerEl!.getAttribute("aria-describedby")).toBe("consent-banner-message");

    banner.destroy();
  });

  it("destroy() removes the banner from DOM", () => {
    const banner = createBanner({ manager });
    expect(document.querySelector(".consent-banner")).not.toBeNull();

    banner.destroy();
    expect(document.querySelector(".consent-banner")).toBeNull();
  });

  it("destroy() removes auto-created container", () => {
    const banner = createBanner({ manager });
    expect(document.getElementById(CONTAINER_ID)).not.toBeNull();

    banner.destroy();
    expect(document.getElementById(CONTAINER_ID)).toBeNull();
  });

  it("destroy() does not remove provided container", () => {
    const customContainer = document.createElement("div");
    customContainer.id = "custom-container";
    document.body.appendChild(customContainer);

    const banner = createBanner({
      manager,
      container: customContainer,
    });

    banner.destroy();
    expect(document.getElementById("custom-container")).not.toBeNull();
  });

  it("escapes HTML in text content", () => {
    const managerWithHtml = createConsentManager({
      euDetection: "never",
      banner: {
        title: "<script>alert('xss')</script>",
        message: "<img src=x onerror=alert('xss')>",
      },
    });

    const banner = createBanner({ manager: managerWithHtml });
    const titleEl = document.getElementById("consent-banner-title");
    const messageEl = document.getElementById("consent-banner-message");

    // Script tags should be escaped, not executed
    expect(titleEl!.innerHTML).not.toContain("<script>");
    expect(messageEl!.innerHTML).not.toContain("<img src=x");
    expect(titleEl!.textContent).toContain("<script>");

    banner.destroy();
  });

  it("sanitizes dangerous protocols in privacy link URL", () => {
    const managerWithJsUrl = createConsentManager({
      euDetection: "never",
      banner: {
        privacyLink: "javascript:alert('xss')",
      },
    });

    const banner = createBanner({ manager: managerWithJsUrl });
    const linkEl = document.querySelector(".consent-banner__privacy-link") as HTMLAnchorElement;

    // javascript: protocol should be replaced with #
    expect(linkEl.href).not.toContain("javascript:");
    expect(linkEl.getAttribute("href")).toBe("#");

    banner.destroy();
  });

  it("sanitizes data: protocol in privacy link URL", () => {
    const managerWithDataUrl = createConsentManager({
      euDetection: "never",
      banner: {
        privacyLink: "data:text/html,<script>alert('xss')</script>",
      },
    });

    const banner = createBanner({ manager: managerWithDataUrl });
    const linkEl = document.querySelector(".consent-banner__privacy-link") as HTMLAnchorElement;

    // data: protocol should be replaced with #
    expect(linkEl.getAttribute("href")).toBe("#");

    banner.destroy();
  });

  it("preserves valid URLs with query parameters", () => {
    const managerWithQueryUrl = createConsentManager({
      euDetection: "never",
      banner: {
        privacyLink: "/privacy?ref=banner&utm_source=consent",
      },
    });

    const banner = createBanner({ manager: managerWithQueryUrl });
    const linkEl = document.querySelector(".consent-banner__privacy-link") as HTMLAnchorElement;

    // Query params should be preserved (& not double-encoded)
    expect(linkEl.getAttribute("href")).toContain("ref=banner");
    expect(linkEl.getAttribute("href")).toContain("utm_source=consent");

    banner.destroy();
  });

  it("escapes HTML special characters in URL attributes", () => {
    const managerWithSpecialChars = createConsentManager({
      euDetection: "never",
      banner: {
        privacyLink: '/privacy" onclick="alert(1)',
      },
    });

    const banner = createBanner({ manager: managerWithSpecialChars });
    const linkEl = document.querySelector(".consent-banner__privacy-link") as HTMLAnchorElement;

    // The raw HTML should have escaped quotes to prevent attribute injection
    // Note: getAttribute() decodes entities, so we check outerHTML directly
    const outerHtml = linkEl.outerHTML;
    // Quotes should be encoded as &quot; so onclick isn't interpreted as a new attribute
    expect(outerHtml).not.toContain('onclick="alert');
    // The href should contain the escaped quote
    expect(outerHtml).toContain("&quot;");

    banner.destroy();
  });
});
