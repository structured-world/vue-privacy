// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsentManager } from "../core/consent-manager";
import { initGoogleAnalytics, initGtag } from "../core/gtag";
import { storeConsent } from "../core/storage";
import type {
  ConsentConfig,
  ConsentStorage,
  GeoDetectionResult,
  GoogleConsentSignals,
} from "../core/types";

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
  if (ran) markTagRan();
}

/** What gtag.js leaves behind once it ran for this measurement ID. */
function markTagRan(): void {
  window.google_tag_manager = { [GA_ID]: {} };
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

/**
 * Settles the gtag.js element the way a browser would: a script that loads runs, and gtag.js
 * registers its measurement ID while running, before the load event. `index` picks the element
 * when an earlier one was given up on and stays on the page.
 */
function settlePendingTag(outcome: "load" | "error", index = 0): void {
  if (outcome === "load") markTagRan();
  gtagScripts()[index].dispatchEvent(new Event(outcome));
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
          if (scriptOutcome === "load") markTagRan();
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
    scriptOutcome = "manual";
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

  it("puts the default ahead of a host snippet's queued js and config", async () => {
    // The site's own gtag snippet queued js/config before the manager ran and its script is
    // still downloading: the denied default must be processed before that config's page view.
    initGtag();
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    scriptOutcome = "manual";
    preloadGtagScript(false);

    await euManager().init();

    expect(order()).toEqual(["consent:default", "js", "config"]);
  });

  it("keeps an update after the default when the host queued its own js first", async () => {
    // Placing the update ahead of measurement must not put it ahead of the default, which
    // would then override the choice.
    initGtag();
    window.gtag("js", new Date());
    scriptOutcome = "manual";
    const manager = euManager();
    await manager.init();

    await manager.acceptAll();

    const commandOrder = order();
    expect(commandOrder.indexOf("consent:default")).toBe(0);
    expect(commandOrder.indexOf("consent:update")).toBe(1);
    expect(consentCalls("update")).toEqual([GRANTED]);
  });

  it("sends no events after the visitor rejects on this page", async () => {
    // The refusal is stored and tracking calls stay suppressed on the page where it was made;
    // a later grant on the same page lets them through again.
    const manager = euManager();
    await manager.init();

    await manager.rejectAll();
    manager.trackEvent("sign_up");
    manager.trackPageView("/after-refusal");
    expect(count("event")).toBe(0);

    await manager.acceptAll();
    manager.trackEvent("sign_up");
    expect(count("event")).toBe(1);
  });

  it("queues the banner when a reset happens before the banner component mounts", async () => {
    // init() stops after a reset made during geo detection; with no banner callback yet, the
    // reset itself must leave the banner pending for the component that mounts later.
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const manager = euManager({
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
    });

    const initDone = manager.init();
    manager.resetConsent();
    resolveGeo({ isEU: true, countryCode: "DE", method: "manual" });
    await initDone;

    const showBanner = vi.fn();
    manager.onShowBanner(showBanner);
    expect(showBanner).toHaveBeenCalledTimes(1);
  });

  it("gives up on another integration's gtag.js element that never settles", async () => {
    // Its load or error event may have fired before the manager ran; waiting only for future
    // events would hang the load forever and block every retry.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      scriptOutcome = "manual";
      preloadGtagScript(false);
      const onGoogleAnalyticsError = vi.fn();
      const manager = euManager({ onGoogleAnalyticsError });
      await manager.init();

      const [host] = gtagScripts();

      await vi.advanceTimersByTimeAsync(10_000);
      expect(onGoogleAnalyticsError).toHaveBeenCalledTimes(1);
      // The element belongs to the other integration and stays; the retry adds its own.
      expect([...gtagScripts()]).toEqual([host]);

      await manager.acceptAll();
      expect(gtagScripts()).toHaveLength(2);
      expect(gtagScripts()[0]).toBe(host);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not add a second gtag.js when a timed-out element recovers", async () => {
    // Regression: an element marked as stalled that later ran was skipped by the lookup, so the
    // next attempt appended a second gtag.js even though the tag was already up.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      scriptOutcome = "manual";
      preloadGtagScript(false);
      const manager = euManager();
      await manager.init();
      await vi.advanceTimersByTimeAsync(10_000);

      markTagRan();
      await manager.acceptAll();
      expect(gtagScripts()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies a choice when writing the consent cookie throws", async () => {
    // Regression: a cookie setter that throws (a sandboxed iframe) aborted the choice before
    // its consent update, listeners and dialog handling.
    const manager = euManager();
    await manager.init();
    Object.defineProperty(document, "cookie", {
      get: () => {
        throw new Error("SecurityError");
      },
      set: () => {
        throw new Error("SecurityError");
      },
      configurable: true,
    });
    const hide = vi.fn();
    manager.onHideBanner(hide);

    await manager.acceptAll();
    expect(consentCalls("update")).toEqual([GRANTED]);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it("gives up on its own gtag.js element that never settles", async () => {
    // Regression: the library's own element had no timeout, so a load that neither loaded nor
    // failed kept every later retry waiting forever.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      scriptOutcome = "manual";
      const onGoogleAnalyticsError = vi.fn();
      const manager = euManager({ onGoogleAnalyticsError });
      await manager.init();

      await vi.advanceTimersByTimeAsync(10_000);
      expect(onGoogleAnalyticsError).toHaveBeenCalledTimes(1);

      await manager.acceptAll();
      expect(gtagScripts()).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not count another Google tag as this measurement ID's load", async () => {
    // Regression: window.google_tag_manager is page-wide, so an unrelated GTM container made a
    // still-pending element for this ID count as loaded, and its failure was never retried.
    scriptOutcome = "manual";
    preloadGtagScript(false);
    window.google_tag_manager = { "GTM-OTHER": {} };
    const onGoogleAnalyticsError = vi.fn();
    const manager = euManager({ onGoogleAnalyticsError });
    await manager.init();

    settlePendingTag("error");
    await settle();
    expect(onGoogleAnalyticsError).toHaveBeenCalledTimes(1);
  });

  it("writes a newer choice to the record an earlier write created", async () => {
    // Regression: the id returned by a superseded write was dropped, so the newer write sent
    // no id and the backend created a second record for the same visitor.
    const pending: Array<() => void> = [];
    const set = vi.fn<ConsentStorage["set"]>(
      () => new Promise<string | null>((resolve) => pending.push(() => resolve("uid-1")))
    );
    const storage: ConsentStorage = { get: async () => null, set };
    const manager = euManager({ storage });
    await manager.init();

    await manager.acceptAll();
    await settle();
    await manager.savePreferences({ analytics: true, marketing: false });
    await settle();
    pending[0]?.();
    await settle();
    expect(set.mock.calls[1]?.[0]).toBe("uid-1");
  });

  it("returns a copy of this page's choice from getConsent()", async () => {
    // Regression: the live object came back, so a preference UI editing it changed the
    // effective consent before the visitor saved anything.
    const manager = euManager();
    await manager.init();
    await manager.rejectAll();

    const view = manager.getConsent();
    if (view) view.categories.analytics = true;
    expect(manager.getConsent()?.categories.analytics).toBe(false);
  });

  it("drops a reset's pending banner when the visitor chooses before the banner mounts", async () => {
    // Regression: the pending flag outlived the choice, so the banner component mounting later
    // asked a visitor who had already decided.
    const manager = euManager();
    manager.resetConsent();
    await manager.acceptAll();

    const show = vi.fn();
    manager.onShowBanner(show);
    expect(show).not.toHaveBeenCalled();
  });

  it("keeps a refusal as the current consent", async () => {
    // Regression: the refusal cleared the cookie and getConsent() returned null, so the script
    // blocker kept functional scripts added after the choice blocked.
    storeConsent({ categories: { analytics: true, marketing: true, functional: true } });
    const manager = euManager();
    await manager.init();

    await manager.rejectAll();
    expect(manager.getConsent()?.categories).toEqual({
      analytics: false,
      marketing: false,
      functional: true,
    });
    expect(manager.hasConsent()).toBe(true);

    manager.resetConsent();
    expect(manager.getConsent()).toBeNull();
  });

  it("does not notify listeners of a choice a consent callback replaced", async () => {
    // Regression: a callback that reset consent was followed by listener notifications with the
    // superseded grant, so the script blocker could run scripts the visitor no longer allowed.
    let manager: ConsentManager | null = null;
    manager = euManager({
      onConsentChange: (consent) => {
        if (consent.categories.analytics) manager?.resetConsent();
      },
    });
    const listener = vi.fn();
    manager.onConsentChange(listener);
    await manager.init();

    await manager.acceptAll();
    expect(listener).not.toHaveBeenCalled();
  });

  it("suppresses tracking after a refusal even when the consent cookie cannot be written", async () => {
    // Regression: with cookies blocked the refusal could not be read back, so events were sent.
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: () => {},
      configurable: true,
    });
    const manager = euManager();
    await manager.init();
    await manager.rejectAll();

    const events = count("event");
    manager.trackEvent("sign_up");
    manager.trackPageView("/after-refusal");
    expect(count("event")).toBe(events);
    expect(manager.getConsent()?.categories.analytics).toBe(false);
    // Both getters describe the same choice: the visitor has decided.
    expect(manager.hasConsent()).toBe(true);
  });

  it("applies a choice when the remote storage throws synchronously", async () => {
    // Regression: a set() that threw instead of rejecting aborted the choice before its
    // consent update, listeners and dialog handling; remote storage is best-effort.
    const storage: ConsentStorage = {
      get: async () => null,
      set: () => {
        throw new Error("storage down");
      },
    };
    const manager = euManager({ storage });
    await manager.init();
    const hide = vi.fn();
    manager.onHideBanner(hide);

    await manager.acceptAll();
    expect(consentCalls("update")).toEqual([GRANTED]);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it("writes remote consent in order when choices follow each other quickly", async () => {
    // Regression: two writes of the same remote record ran at once, so the older one could
    // finish last and bring back a category the visitor had just turned off.
    const pending: Array<() => void> = [];
    const set = vi.fn<ConsentStorage["set"]>(
      () => new Promise<string | null>((resolve) => pending.push(() => resolve("uid-1")))
    );
    const storage: ConsentStorage = { get: async () => null, set };
    const manager = euManager({ storage });
    await manager.init();

    await manager.acceptAll();
    await settle();
    await manager.savePreferences({ analytics: true, marketing: false });
    await settle();
    expect(set).toHaveBeenCalledTimes(1);

    pending[0]();
    await settle();
    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls[1]?.[1].categories).toEqual({
      analytics: true,
      marketing: false,
      functional: true,
    });
  });

  it("puts the consent default ahead of a queued GTM bootstrap event", async () => {
    // Regression: the GTM snippet's object entry was not a measurement boundary, so the
    // container could run its tags before the denied defaults applied.
    const gtmBootstrap = { "gtm.start": Date.now(), event: "gtm.js" };
    window.dataLayer.push(gtmBootstrap);
    const manager = euManager();
    await manager.init();

    const defaultIndex = window.dataLayer.findIndex((entry) => {
      const command = Array.from(entry as ArrayLike<unknown>);
      return command[0] === "consent" && command[1] === "default";
    });
    expect(defaultIndex).toBeGreaterThanOrEqual(0);
    expect(defaultIndex).toBeLessThan(window.dataLayer.indexOf(gtmBootstrap));
  });

  it("issues one consent default per page across manager instances", async () => {
    // Regression: the sent flag lived on the instance, so a remounted app issued a second
    // consent default on the same page.
    const first = euManager();
    await first.init();
    first.destroy();

    const second = euManager();
    await second.init();
    expect(consentCalls("default")).toHaveLength(1);
    expect(count("config")).toBe(1);
  });

  it("does not retry the tag load when the error callback destroys the manager", async () => {
    // Regression: the destroy check ran before onGoogleAnalyticsError, so a callback that
    // unmounted the app still let the pending retry append a script after teardown.
    let current: ConsentManager | null = null;
    const { manager, initDone } = await initWithPendingTag({
      onGoogleAnalyticsError: () => current?.destroy(),
    });
    current = manager;
    await initDone;
    await manager.acceptAll();

    settlePendingTag("error");
    await settle();
    expect(gtagScripts()).toHaveLength(0);
  });

  it("stops loading gtag.js once the manager is destroyed", async () => {
    // Regression: a load that failed after destroy() still reported the error and retried,
    // appending a new script for an app that had unmounted.
    const onGoogleAnalyticsError = vi.fn();
    const { manager, initDone } = await initWithPendingTag({ onGoogleAnalyticsError });
    await initDone;
    await manager.acceptAll();

    manager.destroy();
    settlePendingTag("error");
    await settle();
    expect(onGoogleAnalyticsError).not.toHaveBeenCalled();
    expect(gtagScripts()).toHaveLength(0);
  });

  it("leaves the banner shown when a consent callback resets the choice", async () => {
    // The reset made inside the callback is the latest decision; the outer choice must not
    // then hide the banner the reset just showed.
    const events: string[] = [];
    let manager: ConsentManager | null = null;
    manager = euManager({
      onConsentChange: (consent) => {
        if (consent.categories.analytics) manager?.resetConsent();
      },
    });
    manager.onShowBanner(() => events.push("show"));
    manager.onHideBanner(() => events.push("hide"));
    await manager.init();
    events.length = 0;

    await manager.acceptAll();

    expect(events.at(-1)).toBe("show");
    expect(manager.getConsent()).toBeNull();
  });

  it("closes the preference centre when a consent callback resets the choice", async () => {
    // The banner the reset shows must not stay hidden behind the still open preference centre.
    let manager: ConsentManager | null = null;
    const hidePreferenceCenter = vi.fn();
    manager = euManager({
      onConsentChange: (consent) => {
        if (consent.categories.analytics) manager?.resetConsent();
      },
    });
    manager.onHidePreferenceCenter(hidePreferenceCenter);
    await manager.init();

    await manager.savePreferences({ analytics: true });

    expect(hidePreferenceCenter).toHaveBeenCalledTimes(1);
    expect(manager.getConsent()).toBeNull();
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
    // Regression: the consent was stored before geo detection resolved, without isEU; on the
    // next EU page load the roaming check took it for non-EU consent and asked again.
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const manager = euManager({
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
    });

    const initDone = manager.init();
    await manager.acceptAll();
    resolveGeo({ isEU: true, countryCode: "DE", method: "manual" });
    await initDone;

    expect(manager.getConsent()).toMatchObject({
      isEU: true,
      countryCode: "DE",
      categories: { analytics: true },
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
    const [host] = gtagScripts();

    settlePendingTag("error");
    await settle();
    expect(onGoogleAnalyticsError).toHaveBeenCalledTimes(1);

    // The failed element is the other integration's and stays; the retry loads its own.
    await manager.acceptAll();
    expect(gtagScripts()).toHaveLength(2);
    expect(gtagScripts()[0]).toBe(host);
    settlePendingTag("load", 1);
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

  it("keeps the choice when a consent callback edits the categories it received", async () => {
    // Regression: the page's choice kept the object handed to the callbacks, so an edit to it
    // changed the consent in effect without saving it or updating Google's signals.
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: () => {},
      configurable: true,
    });
    const received: Array<{ analytics: boolean }> = [];
    const manager = euManager({ onConsentChange: (consent) => received.push(consent.categories) });
    manager.onConsentChange((categories) => received.push(categories));
    await manager.init();
    await manager.rejectAll();

    for (const categories of received) categories.analytics = true;
    const events = count("event");
    manager.trackEvent("sign_up");
    expect(count("event")).toBe(events);
    expect(manager.getConsent()?.categories.analytics).toBe(false);
  });

  it("follows a refusal another tab saved after this page's grant", async () => {
    // Regression: the grant kept for this page took precedence over the shared cookie, so a
    // withdrawal made in another tab did not stop this tab's tracking calls.
    const thisTab = euManager();
    await thisTab.init();
    await thisTab.acceptAll();

    const otherTab = euManager();
    await otherTab.init();
    await otherTab.rejectAll();

    const events = count("event");
    thisTab.trackEvent("sign_up");
    thisTab.trackPageView("/after-withdrawal");
    expect(count("event")).toBe(events);
    expect(thisTab.getConsent()?.categories.analytics).toBe(false);
  });

  it("keeps a refusal that could not be stored over a grant from the same millisecond", async () => {
    // Regression: an equal timestamp counted as proof the cookie was current, so the grant still
    // readable from it overrode the refusal made right after, and tracking calls went out.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(1_000_000);
      const manager = euManager();
      await manager.init();
      await manager.acceptAll();

      const grantCookie = cookieStore;
      Object.defineProperty(document, "cookie", {
        get: () => grantCookie,
        set: () => {},
        configurable: true,
      });
      await manager.rejectAll();

      const events = count("event");
      manager.trackEvent("sign_up");
      expect(count("event")).toBe(events);
      expect(manager.getConsent()?.categories.analytics).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts a pending remote write when a newer choice is made", async () => {
    // Regression: remote writes ran one after another, so a write that never settled held
    // every later choice back from the remote record for the rest of the page.
    const set = vi.fn<ConsentStorage["set"]>(
      (_uid, _consent, signal) =>
        new Promise<string | null>((_resolve, reject) =>
          signal?.addEventListener("abort", () => reject(signal.reason))
        )
    );
    const manager = euManager({ storage: { get: async () => null, set } });
    await manager.init();

    await manager.acceptAll();
    await settle();
    await manager.rejectAll();
    await settle();

    expect(set.mock.calls[0]?.[2]?.aborted).toBe(true);
    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls[1]?.[1].categories.analytics).toBe(false);
  });

  it("stops waiting for a superseded remote write that ignores the abort", async () => {
    // A custom storage may not take the signal; its write still must not hold later choices.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const set = vi.fn<ConsentStorage["set"]>(() => new Promise<string | null>(() => {}));
      const manager = euManager({ storage: { get: async () => null, set } });
      await manager.init();

      await manager.acceptAll();
      await vi.advanceTimersByTimeAsync(0);
      await manager.rejectAll();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(set).toHaveBeenCalledTimes(2);
      expect(set.mock.calls[1]?.[1].categories.analytics).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not count its own gtag.js load that did not register the measurement ID", async () => {
    // Regression: a script that fired load without running the tag (a blocker's stand-in)
    // counted as loaded, so the failure was neither reported nor retried.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      scriptOutcome = "manual";
      const onGoogleAnalyticsError = vi.fn();
      const manager = euManager({ onGoogleAnalyticsError });
      await manager.init();

      gtagScripts()[0].dispatchEvent(new Event("load"));
      await vi.advanceTimersByTimeAsync(10_000);
      expect(onGoogleAnalyticsError).toHaveBeenCalledTimes(1);

      await manager.acceptAll();
      expect(gtagScripts()).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not count another integration's gtag.js load that did not register the ID", async () => {
    // Same as above for an element the site added itself.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      scriptOutcome = "manual";
      preloadGtagScript(false);
      const onGoogleAnalyticsError = vi.fn();
      const manager = euManager({ onGoogleAnalyticsError });
      await manager.init();

      gtagScripts()[0].dispatchEvent(new Event("load"));
      await vi.advanceTimersByTimeAsync(10_000);
      expect(onGoogleAnalyticsError).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts a load whose tag registers the measurement ID only after the load event", async () => {
    // The deadline, not the load event, is the last word: a tag that is up by then has loaded.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      scriptOutcome = "manual";
      const onGoogleAnalyticsError = vi.fn();
      const manager = euManager({ onGoogleAnalyticsError });
      await manager.init();

      gtagScripts()[0].dispatchEvent(new Event("load"));
      markTagRan();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(onGoogleAnalyticsError).not.toHaveBeenCalled();

      await manager.acceptAll();
      expect(gtagScripts()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
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
