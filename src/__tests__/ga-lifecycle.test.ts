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

/** A gtag.js element the site added itself; `ran` marks it as already executed. */
function preloadGtagScript(ran: boolean): void {
  const script = document.createElement("script");
  script.src = GTAG_SRC;
  document.head.appendChild(script);
  if (ran) window.google_tag_manager = {};
}

/** dataLayer command names in order, with the consent kind spelled out. */
function order(): string[] {
  return commands().map((c) => String(c[0]) + (c[0] === "consent" ? `:${c[1]}` : ""));
}

/** Starts an EU visitor's init() and returns once its gtag.js is appended and still loading. */
async function initWithPendingTag(
  config: ConsentConfig = {}
): Promise<{ manager: ConsentManager; initDone: Promise<void> }> {
  scriptOutcome = "manual";
  const manager = euManager(config);
  const initDone = manager.init();
  await vi.waitFor(() => expect(gtagScripts()).toHaveLength(1));
  return { manager, initDone };
}

/** Settles the one gtag.js on the page the way a browser would. */
function settlePendingTag(outcome: "load" | "error"): void {
  gtagScripts()[0].dispatchEvent(new Event(outcome));
}

/** One consent default, one `js`, one `config`, and exactly these updates. */
function expectInitialisedOnce(updates: GoogleConsentSignals[]): void {
  expect(consentCalls("default")).toHaveLength(1);
  expect(consentCalls("update")).toEqual(updates);
  expect(count("js")).toBe(1);
  expect(count("config")).toBe(1);
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
  delete window.google_tag_manager;
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
    expectInitialisedOnce([GRANTED, DENIED, ANALYTICS_ONLY]);
    expect(gtagScripts()).toHaveLength(1);
  });

  it("issues the consent default before js and config", async () => {
    await euManager().init();

    expect(order()).toEqual(["consent:default", "js", "config"]);
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

  it("follows a late default with an update when the Google tag already ran", async () => {
    // Defaults apply only before the tag runs; a site that loaded gtag.js itself would keep
    // its own consent state unless the stored choice also arrives as an update.
    storeConsent(
      { categories: { analytics: true, marketing: false, functional: true }, isEU: true },
      {}
    );
    preloadGtagScript(true);

    await euManager().init();

    expect(consentCalls("default")).toEqual([ANALYTICS_ONLY]);
    expect(consentCalls("update")).toEqual([ANALYTICS_ONLY]);
    expect(count("config")).toBe(1);
    expect(gtagScripts()).toHaveLength(1);
  });

  it("keeps the update wait when another gtag.js is still downloading", async () => {
    // A script element alone does not mean the tag ran: the undecided visitor's default is
    // still on time and must keep holding the first hits for the banner's answer.
    preloadGtagScript(false);

    await euManager().init();

    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
    expect(consentCalls("update")).toEqual([]);
  });

  it("sends only an update when consent changes while gtag.js is still loading", async () => {
    // The visitor clicks before the script's load event: initialisation is already in flight,
    // so the click must not start a second one.
    const { manager, initDone } = await initWithPendingTag();

    const choice = manager.acceptAll();
    settlePendingTag("load");
    await choice;
    await initDone;

    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
    expectInitialisedOnce([GRANTED]);
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
    // init() does not wait for the tag; the failure is reported once the load settles.
    await settle();

    expect(showBanner).toHaveBeenCalledTimes(1);
    expect(onGoogleAnalyticsError).toHaveBeenCalledTimes(1);
    expect(onGoogleAnalyticsError.mock.calls[0][0]).toEqual(
      new Error(`Failed to load gtag.js for ${GA_ID}`)
    );
    expect(gtagScripts()).toHaveLength(0);

    scriptOutcome = "load";
    await manager.acceptAll();
    await settle();

    expect(manager.getConsent()?.categories.analytics).toBe(true);
    expectInitialisedOnce([GRANTED]);
    expect(gtagScripts()).toHaveLength(1);
  });

  it("retries the load when it fails after a choice made during it", async () => {
    // The click found the first load in flight and started nothing; when that load then fails,
    // no later consent change may come to retry it, so the failure itself must.
    const { manager, initDone } = await initWithPendingTag();

    const choice = manager.acceptAll();
    settlePendingTag("error");
    await vi.waitFor(() => expect(gtagScripts()).toHaveLength(1));
    settlePendingTag("load");
    await choice;
    await initDone;
    await settle();

    expectInitialisedOnce([GRANTED]);
  });

  it("queues config ahead of events tracked while gtag.js is still loading", async () => {
    // `js` and `config` are queued with the default, as in Google's snippet, so an event
    // tracked before the script runs is still processed after them.
    const { manager, initDone } = await initWithPendingTag();
    await initDone;

    await manager.acceptAll();
    manager.trackEvent("sign_up");
    settlePendingTag("load");

    // The update made before the tag ran is placed ahead of `js` and `config`.
    expect(order()).toEqual(["consent:default", "consent:update", "js", "config", "event"]);
  });

  it("queues config ahead of page views tracked after a failed load", async () => {
    // Regression: init() resolved with no config queued after a failed load, so router page
    // views tracked before the retry came ahead of `js` and `config`.
    scriptOutcome = "error";
    const manager = euManager();
    await manager.init();

    manager.trackPageView("/after-failure");
    scriptOutcome = "load";
    await manager.acceptAll();
    await settle();

    expect(order().indexOf("config")).toBeLessThan(order().indexOf("event"));
    expect(count("config")).toBe(1);
    expect(gtagScripts()).toHaveLength(1);
  });

  it("delivers no stale grant to listeners after consent is withdrawn", async () => {
    // Regression: the grant's callbacks waited for gtag.js; a reset made meanwhile was followed
    // by that stale grant reaching the script blocker, which then ran blocked scripts.
    const { manager } = await initWithPendingTag();
    const seen: boolean[] = [];
    manager.onConsentChange((categories) => seen.push(categories.analytics));

    void manager.acceptAll();
    manager.resetConsent();
    const atReset = [...seen];
    settlePendingTag("load");
    await settle();

    expect(seen).toEqual(atReset);
  });

  it("returns to the undecided state on resetConsent while init() is pending", async () => {
    // A reset after an early choice makes the visitor undecided again: the granted signals go
    // back to denied and the banner asks, whatever the pending flow then resolves.
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const showBanner = vi.fn();
    const manager = euManager({
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
    });
    manager.onShowBanner(showBanner);

    const initDone = manager.init();
    await manager.acceptAll();
    manager.resetConsent();
    resolveGeo({ isEU: true, countryCode: "DE", method: "manual" });
    await initDone;

    expect(consentCalls("update").at(-1)).toEqual(DENIED);
    expect(showBanner).toHaveBeenCalled();
    expect(manager.getConsent()).toBeNull();
  });

  it("does not grant over a reset made while init() detects a non-EU location", async () => {
    // Regression: the reset cleared the choice guard, so the pending flow could not tell it
    // from an untouched start and granted every signal while the banner was asking.
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const manager = euManager({
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
    });

    const initDone = manager.init();
    manager.resetConsent();
    resolveGeo({ isEU: false, method: "manual" });
    await initDone;

    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
    expect(consentCalls("update")).toEqual([]);
  });

  it("orders a withdrawal made before gtag.js runs ahead of config", async () => {
    // A returning visitor's final grant queues `config` (and its page view) at once; a refusal
    // made before the tag runs must be processed before that hit, not after it.
    storeConsent(
      { categories: { analytics: true, marketing: true, functional: true }, isEU: true },
      {}
    );
    scriptOutcome = "manual";
    const manager = euManager();
    await manager.init();

    await manager.rejectAll();

    expect(order()).toEqual(["consent:default", "consent:update", "js", "config"]);
    expect(consentCalls("update")).toEqual([DENIED]);
  });

  it("stores the choice before running consent callbacks", async () => {
    // A callback that tracks or decides must see the choice being made, and a decision it
    // makes itself (a reset) must not be overwritten by the outer choice.
    const seenInCallback: (boolean | undefined)[] = [];
    let manager: ConsentManager | null = null;
    manager = euManager({
      onConsentChange: (consent) => {
        seenInCallback.push(manager?.getConsent()?.categories.analytics);
        if (consent.categories.analytics) manager?.resetConsent();
      },
    });
    await manager.init();

    await manager.acceptAll();

    expect(seenInCallback).toEqual([true]);
    expect(manager.getConsent()).toBeNull();
  });

  it("keeps the location of a choice made while init() detects it", async () => {
    // Regression: the choice was stored before geo detection resolved, without isEU; on the
    // next EU page load the roaming check took it for non-EU consent and asked again.
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const manager = euManager({
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
    });

    const initDone = manager.init();
    await manager.rejectAll();
    resolveGeo({ isEU: true, countryCode: "DE", method: "manual" });
    await initDone;

    expect(manager.getConsent()).toMatchObject({
      isEU: true,
      countryCode: "DE",
      categories: { analytics: false },
    });
  });

  it("waits for a gtag.js element that another integration added and is still loading", async () => {
    // Regression: the element's mere presence counted as loaded, so its failure was neither
    // reported nor retried.
    scriptOutcome = "manual";
    preloadGtagScript(false);
    const onGoogleAnalyticsError = vi.fn();
    const manager = euManager({ onGoogleAnalyticsError });
    await manager.init();

    settlePendingTag("error");
    await settle();
    expect(onGoogleAnalyticsError).toHaveBeenCalledTimes(1);

    await manager.acceptAll();
    expect(gtagScripts()).toHaveLength(1);
    settlePendingTag("load");
    await settle();
    expect(count("config")).toBe(1);
  });

  it("still detects the jurisdiction after a reset during the remote lookup", async () => {
    // A reset stops init() from applying consent, not from learning where the visitor is:
    // isCCPAUser() drives the site's "Do Not Sell" link for this page.
    cookieStore = "consent_uid=uid-1";
    let resolveRemote: (value: null) => void = () => {};
    const manager = euManager({
      ccpaEnabled: true,
      storage: {
        get: () => new Promise((resolve) => (resolveRemote = resolve)),
        set: vi.fn().mockResolvedValue(null),
      },
      geoDetector: {
        detect: vi
          .fn()
          .mockResolvedValue({ isEU: false, countryCode: "US", region: "CA", method: "manual" }),
      },
    });

    const initDone = manager.init();
    manager.resetConsent();
    resolveRemote(null);
    await initDone;

    expect(manager.isCCPAUser()).toBe(true);
    expect(consentCalls("update")).toEqual([]);
  });

  it("does not restore a grant cleared by a reset during the roaming check", async () => {
    // init() read the stored grant before the reset; when its location check returns, that
    // stale grant must not be stored or signalled again.
    storeConsent(
      { categories: { analytics: true, marketing: true, functional: true }, isEU: false },
      {}
    );
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const manager = euManager({
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
    });

    const initDone = manager.init();
    manager.resetConsent();
    resolveGeo({ isEU: false, method: "manual" });
    await initDone;

    expect(manager.getConsent()).toBeNull();
    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
    expect(consentCalls("update")).toEqual([]);
  });

  it("runs consent callbacks after config is queued", async () => {
    // A site tracking an event from onConsentChange must find `config` ahead of it.
    let tracked: ConsentManager | null = null;
    const { manager } = await initWithPendingTag({
      onConsentChange: () => tracked?.trackEvent("consent_changed"),
    });
    tracked = manager;

    const choice = manager.acceptAll();
    settlePendingTag("load");
    await choice;

    const order = commands().map((c) => String(c[0]));
    expect(order).toContain("event");
    expect(order.indexOf("config")).toBeLessThan(order.indexOf("event"));
  });

  it("restores a refusal that replaced an earlier grant outside consent jurisdictions", async () => {
    // Regression: withdrawing an earlier grant left nothing stored, so the next visit from a
    // non-consent jurisdiction granted every signal again.
    const first = euManager();
    await first.init();
    await first.acceptAll();
    await first.rejectAll();

    window.dataLayer = [];
    delete (window as Partial<Window>).gtag;
    document.head.innerHTML = "";
    const next = new ConsentManager({
      gaId: GA_ID,
      geoDetector: { detect: vi.fn().mockResolvedValue({ isEU: false, method: "manual" }) },
    });
    await next.init();

    expect(consentCalls("default")).toEqual([DENIED]);
    expect(consentCalls("update")).toEqual([]);
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

  it("queues config once when retried after a failed load", async () => {
    // Both queued `config` commands would be processed once a retry loads the tag, each with
    // its own page view.
    scriptOutcome = "error";
    await expect(initGoogleAnalytics(GA_ID, true)).rejects.toThrow();

    scriptOutcome = "load";
    await initGoogleAnalytics(GA_ID, true);

    expect(count("js")).toBe(1);
    expect(count("config")).toBe(1);
  });
});
