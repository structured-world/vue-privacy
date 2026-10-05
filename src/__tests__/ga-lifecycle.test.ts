// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsentManager } from "../core/consent-manager";
import { initGoogleAnalytics } from "../core/gtag";
import { storeConsent } from "../core/storage";
import type { ConsentConfig, GeoDetectionResult, GoogleConsentSignals } from "../core/types";

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
const ANALYTICS_ONLY: GoogleConsentSignals = { ...DENIED, analytics_storage: "granted" };

let cookieStore = "";

/** What a gtag.js script appended by the library does: load, fail, or wait for the test. */
let scriptOutcome: "load" | "error" | "manual" = "load";
let observer: MutationObserver | null = null;

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

function gtagScripts(): NodeListOf<HTMLScriptElement> {
  return document.querySelectorAll<HTMLScriptElement>(`script[src="${GTAG_SRC}"]`);
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** A tag the site loaded itself before the manager ran. */
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

  // jsdom does not fetch scripts; settle each appended gtag.js the way the test asks.
  scriptOutcome = "load";
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLScriptElement &&
          node.src === GTAG_SRC &&
          scriptOutcome !== "manual"
        ) {
          node.dispatchEvent(new Event(scriptOutcome));
        }
      }
    }
  });
  observer.observe(document.head, { childList: true });
});

afterEach(() => {
  observer?.disconnect();
});

describe("Google Analytics lifecycle in ConsentManager", () => {
  it("initialises once and sends one consent update per change", async () => {
    // Regression: every consent change re-ran initGoogleAnalytics(), issuing another
    // `consent default`, `js` and `config` (an extra page_view each time).
    const manager = euManager();

    await manager.init();
    await manager.acceptAll();
    await manager.rejectAll();
    await manager.savePreferences({ analytics: true, marketing: false });
    await settle();

    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
    expect(count("js")).toBe(1);
    expect(count("config")).toBe(1);
    expect(consentCalls("update")).toEqual([GRANTED, DENIED, ANALYTICS_ONLY]);
    expect(gtagScripts()).toHaveLength(1);
  });

  it("issues the consent default before js and config", async () => {
    await euManager().init();

    const order = commands().map((c) => String(c[0]) + (c[0] === "consent" ? `:${c[1]}` : ""));
    expect(order).toEqual(["consent:default", "js", "config"]);
  });

  it("counts one page_view on a first visit that accepts all", async () => {
    // With sendPageView the page_view is sent by `config`; a second `config` was a second
    // page_view for the same page.
    const manager = euManager({ sendPageView: true });

    await manager.init();
    await manager.acceptAll();
    await settle();

    expect(configCalls()).toEqual([{ send_page_view: true }]);
    expect(commands().filter((c) => c[0] === "event" && c[1] === "page_view")).toHaveLength(0);
  });

  it("restores stored consent with one final default carrying the stored signals", async () => {
    // A returning visitor: the default already is the decision, so there is no update and no
    // wait_for_update holding the first page view for one.
    storeConsent(
      {
        categories: { analytics: true, marketing: false, functional: true },
        isEU: true,
        geoMethod: "manual",
        countryCode: "DE",
      },
      {}
    );

    await euManager().init();

    expect(consentCalls("default")).toEqual([ANALYTICS_ONLY]);
    expect(consentCalls("update")).toEqual([]);
    expect(count("js")).toBe(1);
    expect(count("config")).toBe(1);
  });

  it("grants by a final default outside consent jurisdictions", async () => {
    const manager = new ConsentManager({
      gaId: GA_ID,
      geoDetector: { detect: vi.fn().mockResolvedValue({ isEU: false, method: "manual" }) },
    });

    await manager.init();

    expect(consentCalls("default")).toEqual([GRANTED]);
    expect(consentCalls("update")).toEqual([]);
    expect(count("config")).toBe(1);
  });

  it("follows a late default with an update when gtag.js was already on the page", async () => {
    // Defaults apply only before the tag loads; a site that loaded gtag.js itself would keep
    // its own consent state unless the stored choice also arrives as an update.
    storeConsent(
      { categories: { analytics: true, marketing: false, functional: true }, isEU: true },
      {}
    );
    preloadGtagScript();

    await euManager().init();

    expect(consentCalls("default")).toEqual([ANALYTICS_ONLY]);
    expect(consentCalls("update")).toEqual([ANALYTICS_ONLY]);
    expect(count("config")).toBe(1);
    expect(gtagScripts()).toHaveLength(1);
  });

  it("sends only an update when consent changes while gtag.js is still loading", async () => {
    // The visitor clicks before the script's load event: initialisation is already in flight,
    // so the click must not start a second one.
    scriptOutcome = "manual";
    const manager = euManager();
    const initDone = manager.init();

    await vi.waitFor(() => expect(gtagScripts()).toHaveLength(1));
    await manager.acceptAll();
    gtagScripts()[0].dispatchEvent(new Event("load"));
    await initDone;

    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
    expect(consentCalls("update")).toEqual([GRANTED]);
    expect(count("js")).toBe(1);
    expect(count("config")).toBe(1);
    expect(gtagScripts()).toHaveLength(1);
  });

  it("shows the banner and saves choices when gtag.js fails, then retries the load", async () => {
    // An ad blocker or a network error: the consent flow must not depend on the tag, and a
    // later choice retries the load so measurement recovers once the network does.
    scriptOutcome = "error";
    const onGoogleAnalyticsError = vi.fn();
    const showBanner = vi.fn();
    const manager = euManager({ onGoogleAnalyticsError });
    manager.onShowBanner(showBanner);

    await manager.init();

    expect(showBanner).toHaveBeenCalledTimes(1);
    expect(onGoogleAnalyticsError).toHaveBeenCalledTimes(1);
    expect(onGoogleAnalyticsError.mock.calls[0][0]).toEqual(
      new Error(`Failed to load gtag.js for ${GA_ID}`)
    );
    expect(gtagScripts()).toHaveLength(0);
    expect(count("config")).toBe(0);

    scriptOutcome = "load";
    await manager.acceptAll();
    await settle();

    expect(manager.getConsent()?.categories.analytics).toBe(true);
    expect(consentCalls("default")).toHaveLength(1);
    expect(consentCalls("update")).toEqual([GRANTED]);
    expect(count("js")).toBe(1);
    expect(count("config")).toBe(1);
    expect(gtagScripts()).toHaveLength(1);
  });

  it("resolves init() when the error callback itself throws", async () => {
    // A throwing callback must not turn a failed tag load into a failed init(): integrations
    // start router tracking only after init() resolves.
    scriptOutcome = "error";
    const manager = euManager({
      onGoogleAnalyticsError: () => {
        throw new Error("callback bug");
      },
    });

    await expect(manager.init()).resolves.toBeUndefined();
  });

  it("keeps a choice made while init() is still detecting the location", async () => {
    // The preference centre can be opened before geo detection resolves. When it does, the
    // EU flow must neither send its denied defaults over the choice nor show the banner.
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const showBanner = vi.fn();
    const onConsentChange = vi.fn();
    const manager = euManager({
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
      onConsentChange,
    });
    manager.onShowBanner(showBanner);

    const initDone = manager.init();
    await manager.acceptAll();
    resolveGeo({ isEU: true, countryCode: "DE", method: "manual" });
    await initDone;

    expect(consentCalls("default")).toEqual([GRANTED]);
    expect(consentCalls("update")).toEqual([]);
    expect(showBanner).not.toHaveBeenCalled();
    expect(onConsentChange).toHaveBeenCalledTimes(1);
    expect(manager.getConsent()?.categories.marketing).toBe(true);
  });

  it("keeps a choice made while init() checks a stored consent for roaming", async () => {
    // Stored non-EU consent triggers a location check; a rejection made meanwhile must not be
    // overwritten by the stored grant when the check returns.
    storeConsent(
      { categories: { analytics: true, marketing: true, functional: true }, isEU: false },
      {}
    );
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const manager = euManager({
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
    });

    const initDone = manager.init();
    await manager.rejectAll();
    resolveGeo({ isEU: false, method: "manual" });
    await initDone;

    expect(consentCalls("default")).toEqual([DENIED]);
    expect(consentCalls("update")).toEqual([]);
  });
});

describe("initGoogleAnalytics defaults", () => {
  it("takes per-signal defaults", async () => {
    await initGoogleAnalytics(GA_ID, ANALYTICS_ONLY, false);

    expect(consentCalls("default")).toEqual([{ ...ANALYTICS_ONLY, wait_for_update: 500 }]);
    expect(configCalls()).toEqual([{ send_page_view: false }]);
  });

  it("denies every signal with true", async () => {
    await initGoogleAnalytics(GA_ID, true);

    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
  });

  it("grants every signal with false", async () => {
    await initGoogleAnalytics(GA_ID, false);

    expect(consentCalls("default")).toEqual([{ ...GRANTED, wait_for_update: 500 }]);
  });

  it("omits wait_for_update for final defaults", async () => {
    await initGoogleAnalytics(GA_ID, GRANTED, true, 0);

    expect(consentCalls("default")).toEqual([GRANTED]);
  });
});
