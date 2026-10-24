// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsentManager } from "../core/consent-manager";
import { storeConsent } from "../core/storage";
import { reloadPage } from "../core/page";
import { installCookieJar } from "./helpers/cookie-jar";
import type { ConsentConfig, GoogleConsentSignals } from "../core/types";

// jsdom cannot navigate; the reload a withdrawal may trigger is recorded instead.
vi.mock("../core/page", () => ({ reloadPage: vi.fn() }));

// A Google Tag Manager container loaded by the manager (`gtmId`): the page's single
// `consent default` comes first, then the container's `gtm.js` event, then the container script;
// in basic mode none of it before the visitor allows analytics.

const GTM_ID = "GTM-TEST";
const GA_ID = "G-TEST123";
const GTM_SRC = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
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
/** What a tag script appended by the library does: load, fail, or wait for the test. */
let scriptOutcome: "load" | "error" | "manual" = "load";
let observer: MutationObserver | null = null;

/** dataLayer entries as labels: gtag commands by name (consent with its kind), events by name. */
function order(): string[] {
  return window.dataLayer.map((entry) => {
    if (Array.isArray(entry) || Object.prototype.toString.call(entry) === "[object Arguments]") {
      const command = Array.from(entry as ArrayLike<unknown>);
      return String(command[0]) + (command[0] === "consent" ? `:${command[1]}` : "");
    }
    return `event:${String((entry as Record<string, unknown>).event)}`;
  });
}

function consentCalls(kind: "default" | "update"): Record<string, unknown>[] {
  return window.dataLayer
    .filter((entry) => Object.prototype.toString.call(entry) === "[object Arguments]")
    .map((entry) => Array.from(entry as ArrayLike<unknown>))
    .filter((c) => c[0] === "consent" && c[1] === kind)
    .map((c) => c[2] as Record<string, unknown>);
}

function containerScripts(): NodeListOf<HTMLScriptElement> {
  return document.querySelectorAll<HTMLScriptElement>(`script[src="${GTM_SRC}"]`);
}

/** No container script, no other Google script, no dataLayer entry. */
function expectNothingSentToGoogle(): void {
  expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(0);
  expect(window.dataLayer).toEqual([]);
}

/** What Google Tag Manager leaves behind once the container ran. */
function markContainerRan(): void {
  window.google_tag_manager = { ...(window.google_tag_manager as object), [GTM_ID]: {} };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const created: ConsentManager[] = [];

function euManager(config: ConsentConfig = {}): ConsentManager {
  const manager = new ConsentManager({
    gtmId: GTM_ID,
    geoDetector: {
      detect: vi
        .fn()
        .mockResolvedValue({ consentRequired: true, countryCode: "DE", method: "manual" }),
    },
    ...config,
  });
  created.push(manager);
  return manager;
}

function basicManager(config: ConsentConfig = {}): ConsentManager {
  return euManager({ consentMode: "basic", ...config });
}

function storeChoice(analytics: boolean): void {
  storeConsent(
    { categories: { analytics, marketing: false, functional: true }, consentRequired: true },
    {}
  );
}

beforeEach(() => {
  cookieStore = "";
  installCookieJar(
    () => cookieStore,
    (jar) => {
      cookieStore = jar;
    }
  );
  document.head.innerHTML = "";
  window.dataLayer = [];
  delete (window as Partial<Window>).gtag;
  delete window.google_tag_manager;
  delete (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`];
  vi.mocked(reloadPage).mockClear();

  // jsdom does not fetch scripts; settle each appended tag the way the test asks.
  scriptOutcome = "load";
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLScriptElement) || scriptOutcome === "manual") continue;
        if (node.src !== GTM_SRC && node.src !== GTAG_SRC) continue;
        if (scriptOutcome === "load") {
          if (node.src === GTM_SRC) markContainerRan();
          else
            window.google_tag_manager = { ...(window.google_tag_manager as object), [GA_ID]: {} };
        }
        node.dispatchEvent(new Event(scriptOutcome));
      }
    }
  });
  observer.observe(document.head, { childList: true });
});

afterEach(() => {
  observer?.disconnect();
  for (const manager of created.splice(0)) manager.destroy();
});

describe("Tag Manager container in advanced mode", () => {
  it("queues the denied default before gtm.js and loads the container", async () => {
    // Regression: without gaId the manager issued only updates, so the container's tags had no
    // default for their first hits, which Google treats as granted.
    await euManager().init();
    await settle();

    expect(order()).toEqual(["consent:default", "event:gtm.js"]);
    expect(consentCalls("default")).toEqual([{ ...DENIED, wait_for_update: 500 }]);
    expect(containerScripts()).toHaveLength(1);
    expect(window.dataLayer[1]).toMatchObject({ event: "gtm.js", "gtm.start": expect.any(Number) });
  });

  it("carries a stored choice in a final default, then sends one update per change", async () => {
    storeChoice(true);
    const manager = euManager();
    await manager.init();
    await manager.rejectAll();
    await settle();

    expect(consentCalls("default")).toEqual([ANALYTICS_ONLY]);
    expect(consentCalls("update")).toEqual([DENIED]);
    expect(order().filter((label) => label === "event:gtm.js")).toHaveLength(1);
    expect(containerScripts()).toHaveLength(1);
  });

  it("follows the site's own inline default with an update", async () => {
    // The default a site issues in <head> before the manager runs is the page's single one.
    window.dataLayer.push(["consent", "default", { ...DENIED, wait_for_update: 500 }]);
    storeChoice(true);

    await euManager().init();

    expect(order()).toEqual(["consent:default", "consent:update", "event:gtm.js"]);
    expect(consentCalls("update")).toEqual([ANALYTICS_ONLY]);
  });

  it("starts the container once when the site queued gtm.js and its script itself", async () => {
    // A gtm.js event the site's snippet queued already starts the container; a second one
    // would fire its page-load triggers twice, and a second element would load it twice. The
    // default still goes ahead of the queued event while the container is still downloading.
    window.dataLayer.push({ "gtm.start": 1, event: "gtm.js" });
    scriptOutcome = "manual";
    const own = document.createElement("script");
    own.src = GTM_SRC;
    document.head.appendChild(own);

    await euManager().init();
    await settle();

    expect(order()).toEqual(["consent:default", "event:gtm.js"]);
    expect(containerScripts()).toHaveLength(1);
  });

  it("sends the set fields ahead of gtm.js", async () => {
    // ads_data_redaction has to precede every Ads hit the container's tags send.
    await euManager({ googleAnalytics: { adsDataRedaction: true, urlPassthrough: true } }).init();

    expect(order()).toEqual(["consent:default", "set", "event:gtm.js"]);
    const set = Array.from(window.dataLayer[1] as ArrayLike<unknown>);
    expect(set).toEqual(["set", { ads_data_redaction: true, url_passthrough: true }]);
  });

  it("loads gtag.js and the container side by side with one default", async () => {
    await euManager({ gaId: GA_ID }).init();
    await settle();

    expect(order()).toEqual(["consent:default", "js", "config", "event:gtm.js"]);
    expect(containerScripts()).toHaveLength(1);
    expect(document.querySelectorAll(`script[src="${GTAG_SRC}"]`)).toHaveLength(1);
  });

  it("reports a failed container load and retries on the next consent change", async () => {
    scriptOutcome = "error";
    const errors: unknown[] = [];
    const manager = euManager({ onGoogleAnalyticsError: (error) => errors.push(error) });
    await manager.init();
    await settle();

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe(`Failed to load gtm.js for ${GTM_ID}`);
    expect(containerScripts()).toHaveLength(0);

    scriptOutcome = "load";
    await manager.acceptAll();
    await settle();
    expect(containerScripts()).toHaveLength(1);
    expect(order().filter((label) => label === "event:gtm.js")).toHaveLength(1);
  });
});

describe("Tag Manager container in basic mode", () => {
  it("sends nothing to Google for an undecided visitor", async () => {
    await basicManager().init();

    expectNothingSentToGoogle();
  });

  it("sends nothing to Google after a refusal", async () => {
    const manager = basicManager();
    await manager.init();
    await manager.rejectAll();
    await manager.savePreferences({ analytics: false, marketing: true });

    expectNothingSentToGoogle();
  });

  it("sends nothing to Google on a jurisdiction's grant", async () => {
    // Outside consent jurisdictions everything is granted, but that is not the visitor's choice.
    const manager = basicManager({
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ consentRequired: false, method: "manual" }),
      },
    });
    await manager.init();

    expectNothingSentToGoogle();
  });

  it("loads the container after the visitor allows analytics, with the default first", async () => {
    const manager = basicManager();
    await manager.init();

    await manager.acceptAll();
    await settle();

    expect(order()).toEqual(["consent:default", "event:gtm.js"]);
    expect(consentCalls("default")).toEqual([GRANTED]);
    expect(containerScripts()).toHaveLength(1);
  });

  it("loads the container from a stored grant without showing the banner", async () => {
    storeChoice(true);
    const onBannerShow = vi.fn();

    await basicManager({ onBannerShow }).init();
    await settle();

    expect(onBannerShow).not.toHaveBeenCalled();
    expect(order()).toEqual(["consent:default", "event:gtm.js"]);
    expect(consentCalls("default")).toEqual([ANALYTICS_ONLY]);
    expect(containerScripts()).toHaveLength(1);
  });

  it("reloads on a withdrawal after the container ran, and the reloaded page loads nothing", async () => {
    // A running container cannot be unloaded: its tags keep pinging until the page goes.
    const manager = basicManager({ reloadOnWithdrawal: true });
    await manager.init();
    await manager.acceptAll();
    await settle();

    await manager.rejectAll();
    expect(reloadPage).not.toHaveBeenCalled();
    await settle();

    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(consentCalls("update").at(-1)).toEqual(DENIED);

    // The reloaded page: a fresh document holding only the stored refusal.
    manager.destroy();
    document.head.innerHTML = "";
    window.dataLayer = [];
    delete (window as Partial<Window>).gtag;
    delete window.google_tag_manager;
    vi.mocked(reloadPage).mockClear();

    await basicManager({ reloadOnWithdrawal: true }).init();
    await settle();

    expectNothingSentToGoogle();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("does not reload a withdrawal without the option, but denies and clears _ga cookies", async () => {
    const manager = basicManager();
    await manager.init();
    await manager.acceptAll();
    await settle();
    // Set by the container's GA4 tags, whose measurement IDs the manager never sees.
    document.cookie = "_ga=GA1.1.123.456; path=/";
    document.cookie = "_ga_ABC123=GS1.1.789; path=/";
    document.cookie = "site_ga_ABC123=keep; path=/";

    await manager.rejectAll();
    await settle();

    expect(reloadPage).not.toHaveBeenCalled();
    expect(consentCalls("update").at(-1)).toEqual(DENIED);
    expect(cookieStore).not.toMatch(/(^|; )_ga=/);
    expect(cookieStore).not.toContain("_ga_ABC123=GS1");
    expect(cookieStore).toContain("site_ga_ABC123=keep");
  });

  it("does not reload a withdrawal when the container failed to load", async () => {
    scriptOutcome = "error";
    const manager = basicManager({ reloadOnWithdrawal: true });
    await manager.init();
    await manager.acceptAll();
    await settle();

    scriptOutcome = "manual";
    await manager.rejectAll();
    await settle();

    expect(reloadPage).not.toHaveBeenCalled();
    // A refusal itself must not cause a request to Google: no retry of the failed load.
    expect(containerScripts()).toHaveLength(0);
  });

  it("reloads for a refusal found on start while an earlier manager's container runs", async () => {
    // A remount on the same page: the earlier manager's container still runs, and the refusal
    // the new one restores must stop it.
    const first = basicManager();
    await first.init();
    await first.acceptAll();
    await settle();
    first.destroy();
    storeChoice(false);

    await basicManager({ reloadOnWithdrawal: true }).init();
    await settle();

    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(consentCalls("update").at(-1)).toEqual(DENIED);
  });

  it("does not reload for a refusal found on start when the site loads the container itself", async () => {
    // The site's own container comes back with every load, so a reload would never end.
    const own = document.createElement("script");
    own.src = GTM_SRC;
    document.head.appendChild(own);
    markContainerRan();
    storeChoice(false);

    await basicManager({ reloadOnWithdrawal: true }).init();
    await settle();

    expect(reloadPage).not.toHaveBeenCalled();
  });
});
