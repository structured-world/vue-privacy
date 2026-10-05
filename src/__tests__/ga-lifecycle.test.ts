// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsentManager } from "../core/consent-manager";
import { initGoogleAnalytics } from "../core/gtag";
import { storeConsent } from "../core/storage";
import type { ConsentConfig, GoogleConsentSignals } from "../core/types";

// Google Consent Mode contract: one `consent default` before the tag loads, one `js` and
// one `config` per page, then only `consent update` calls. These tests read the commands
// back from dataLayer, where gtag() pushes its Arguments objects.

const GA_ID = "G-TEST123";
const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;

const DENIED: GoogleConsentSignals = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};
const GRANTED: GoogleConsentSignals = {
  analytics_storage: "granted",
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

let cookieStore = "";

function commands(): unknown[][] {
  return window.dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
}

function consentCalls(kind: "default" | "update"): Record<string, unknown>[] {
  return commands()
    .filter((c) => c[0] === "consent" && c[1] === kind)
    .map((c) => c[2] as Record<string, unknown>);
}

function count(command: string): number {
  return commands().filter((c) => c[0] === command).length;
}

function configCalls(): Record<string, unknown>[] {
  return commands()
    .filter((c) => c[0] === "config")
    .map((c) => c[2] as Record<string, unknown>);
}

/** Marks gtag.js as already on the page, so loadGtagScript() resolves without a network load. */
function preloadGtagScript(): void {
  const script = document.createElement("script");
  script.src = GTAG_SRC;
  document.head.appendChild(script);
}

function euManager(config: ConsentConfig = {}): ConsentManager {
  return new ConsentManager({
    gaId: GA_ID,
    geoDetector: {
      detect: vi.fn().mockResolvedValue({ isEU: true, countryCode: "DE", method: "manual" }),
    },
    ...config,
  });
}

beforeEach(() => {
  cookieStore = "";
  Object.defineProperty(document, "cookie", {
    get: () => cookieStore,
    set: (value: string) => {
      const [nameValue] = value.split(";");
      const [name] = nameValue.split("=");
      const kept = cookieStore
        .split(";")
        .map((c) => c.trim())
        .filter((c) => c && !c.startsWith(`${name}=`));
      if (!value.includes("1970")) kept.push(nameValue);
      cookieStore = kept.join("; ");
    },
    configurable: true,
  });
  document.head.innerHTML = "";
  window.dataLayer = [];
  // Fresh gtag per test: initGtag() keeps an existing function, which would close over an
  // earlier test's dataLayer array.
  delete (window as Partial<Window>).gtag;
  vi.restoreAllMocks();
});

describe("Google Analytics lifecycle in ConsentManager", () => {
  it("initialises once and sends one consent update per change", async () => {
    // Regression: every consent change re-ran initGoogleAnalytics(), issuing another
    // `consent default`, `js` and `config` (an extra page_view each time).
    preloadGtagScript();
    const manager = euManager();

    await manager.init();
    await manager.acceptAll();
    await manager.rejectAll();
    await manager.savePreferences({ analytics: true, marketing: false });

    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
    expect(count("js")).toBe(1);
    expect(count("config")).toBe(1);
    expect(consentCalls("update")).toEqual([
      GRANTED,
      DENIED,
      { ...DENIED, analytics_storage: "granted" },
    ]);
  });

  it("issues the consent default before js and config", async () => {
    preloadGtagScript();
    await euManager().init();

    const order = commands().map((c) => String(c[0]) + (c[0] === "consent" ? `:${c[1]}` : ""));
    expect(order).toEqual(["consent:default", "js", "config"]);
  });

  it("counts one page_view on a first visit that accepts all", async () => {
    // With sendPageView the page_view is sent by `config`; a second `config` was a second
    // page_view for the same page.
    preloadGtagScript();
    const manager = euManager({ sendPageView: true });

    await manager.init();
    await manager.acceptAll();

    expect(configCalls()).toEqual([{ send_page_view: true }]);
    expect(commands().filter((c) => c[0] === "event" && c[1] === "page_view")).toHaveLength(0);
  });

  it("restores stored consent with one default carrying the stored signals", async () => {
    // A returning visitor: the single default already reflects the choice, so page load
    // needs neither an update nor a second config.
    storeConsent(
      {
        categories: { analytics: true, marketing: false, functional: true },
        isEU: true,
        geoMethod: "manual",
        countryCode: "DE",
      },
      {}
    );
    preloadGtagScript();

    await euManager().init();

    expect(consentCalls("default")).toEqual([
      { ...DENIED, analytics_storage: "granted", wait_for_update: 500 },
    ]);
    expect(consentCalls("update")).toEqual([]);
    expect(count("js")).toBe(1);
    expect(count("config")).toBe(1);
  });

  it("grants by default outside consent jurisdictions without an update", async () => {
    preloadGtagScript();
    const manager = new ConsentManager({
      gaId: GA_ID,
      geoDetector: { detect: vi.fn().mockResolvedValue({ isEU: false, method: "manual" }) },
    });

    await manager.init();

    expect(consentCalls("default")).toEqual([{ ...GRANTED, wait_for_update: 500 }]);
    expect(consentCalls("update")).toEqual([]);
    expect(count("config")).toBe(1);
  });

  it("sends only an update when consent changes while gtag.js is still loading", async () => {
    // The visitor clicks before the script's load event: initialisation is already in flight,
    // so the click must not start a second one.
    const manager = euManager();
    const initDone = manager.init();

    await vi.waitFor(() => {
      expect(document.querySelector(`script[src="${GTAG_SRC}"]`)).not.toBeNull();
    });
    await manager.acceptAll();
    document.querySelector(`script[src="${GTAG_SRC}"]`)!.dispatchEvent(new Event("load"));
    await initDone;

    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
    expect(consentCalls("update")).toEqual([GRANTED]);
    expect(count("js")).toBe(1);
    expect(count("config")).toBe(1);
    expect(document.querySelectorAll(`script[src="${GTAG_SRC}"]`)).toHaveLength(1);
  });

  it("keeps consent changes working after gtag.js failed to load", async () => {
    // An ad blocker makes the script fail; init() reports it, later choices still reach
    // the dataLayer as updates instead of retrying the initialisation.
    const manager = euManager();
    const initDone = manager.init();

    await vi.waitFor(() => {
      expect(document.querySelector(`script[src="${GTAG_SRC}"]`)).not.toBeNull();
    });
    document.querySelector(`script[src="${GTAG_SRC}"]`)!.dispatchEvent(new Event("error"));
    await expect(initDone).rejects.toThrow(`Failed to load gtag.js for ${GA_ID}`);

    await manager.acceptAll();

    expect(consentCalls("default")).toHaveLength(1);
    expect(consentCalls("update")).toEqual([GRANTED]);
    expect(count("config")).toBe(0);
  });
});

describe("initGoogleAnalytics defaults", () => {
  it("takes per-signal defaults", async () => {
    preloadGtagScript();

    await initGoogleAnalytics(GA_ID, { ...DENIED, analytics_storage: "granted" }, false);

    expect(consentCalls("default")).toEqual([
      { ...DENIED, analytics_storage: "granted", wait_for_update: 500 },
    ]);
    expect(configCalls()).toEqual([{ send_page_view: false }]);
  });

  it("keeps the boolean form: true denies, false grants every signal", async () => {
    preloadGtagScript();

    await initGoogleAnalytics(GA_ID, true);
    await initGoogleAnalytics(GA_ID, false);

    expect(consentCalls("default")).toEqual([
      { ...DENIED, wait_for_update: 500 },
      { ...GRANTED, wait_for_update: 500 },
    ]);
  });
});
