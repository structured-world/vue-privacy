// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsentManager } from "../core/consent-manager";
import { initGoogleAnalytics } from "../core/gtag";
import { storeConsent } from "../core/storage";
import { installCookieJar } from "./helpers/cookie-jar";
import type { ConsentConfig, GoogleAnalyticsOptions } from "../core/types";

// The googleAnalytics block configures the Google tag through the consent flow: `set` fields
// after the consent default and before `config`, every `config` field in the single `config`
// call. These tests read the commands back from dataLayer.

const GA_ID = "G-TEST123";
const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;

let cookieStore = "";
let observer: MutationObserver | null = null;
const created: ConsentManager[] = [];

function commands(): unknown[][] {
  return window.dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
}

/** dataLayer command names in order, with the consent kind spelled out. */
function order(): string[] {
  return commands().map((c) => String(c[0]) + (c[0] === "consent" ? `:${c[1]}` : ""));
}

function argsOf(command: string): unknown[][] {
  return commands().filter((c) => c[0] === command);
}

function manager(config: ConsentConfig, isEU = true): ConsentManager {
  const instance = new ConsentManager({
    gaId: GA_ID,
    geoDetector: { detect: vi.fn().mockResolvedValue({ isEU, method: "manual" }) },
    ...config,
  });
  created.push(instance);
  return instance;
}

const MINIMISED: GoogleAnalyticsOptions = {
  config: {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: 60 * 60 * 24 * 90,
    cookie_flags: "SameSite=Lax;Secure",
    cookie_update: false,
    debug_mode: true,
    user_properties: { plan: "free" },
  },
  customParameters: { site_section: "docs" },
  set: { cookie_prefix: "site", cookie_domain: "example.com" },
  adsDataRedaction: true,
  urlPassthrough: true,
};

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
  vi.restoreAllMocks();
  // jsdom does not fetch scripts: every appended gtag.js runs and loads.
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLScriptElement && node.src === GTAG_SRC) {
          window.google_tag_manager = { [GA_ID]: {} };
          node.dispatchEvent(new Event("load"));
        }
      }
    }
  });
  observer.observe(document.head, { childList: true });
});

afterEach(() => {
  observer?.disconnect();
  for (const instance of created.splice(0)) instance.destroy();
});

describe("googleAnalytics option", () => {
  it("passes every config field and custom parameter into the single config call", async () => {
    await manager({ googleAnalytics: MINIMISED, sendPageView: false }).init();

    expect(argsOf("config")).toEqual([
      [
        "config",
        GA_ID,
        {
          site_section: "docs",
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          cookie_expires: 7776000,
          cookie_flags: "SameSite=Lax;Secure",
          cookie_update: false,
          debug_mode: true,
          user_properties: { plan: "free" },
          send_page_view: false,
        },
      ],
    ]);
  });

  it("sends set fields and the Consent Mode settings after the default and before config", async () => {
    await manager({ googleAnalytics: MINIMISED }).init();

    expect(order()).toEqual(["consent:default", "set", "js", "config"]);
    expect(argsOf("set")).toEqual([
      [
        "set",
        {
          cookie_prefix: "site",
          cookie_domain: "example.com",
          ads_data_redaction: true,
          url_passthrough: true,
        },
      ],
    ]);
  });

  it("passes an explicit false for the named Consent Mode settings", async () => {
    // A site may turn off what a tag manager container turned on; false is a value, not absence.
    await manager({ googleAnalytics: { adsDataRedaction: false, urlPassthrough: false } }).init();

    expect(argsOf("set")).toEqual([["set", { ads_data_redaction: false, url_passthrough: false }]]);
  });

  it("sends no set command when the block has no set fields", async () => {
    await manager({ googleAnalytics: { config: { allow_google_signals: false } } }).init();

    expect(order()).toEqual(["consent:default", "js", "config"]);
  });

  it("keeps send_page_view from sendPageView, whatever an untyped custom parameter says", async () => {
    // Regression guard: the SPA integrations turn sendPageView off and track page views
    // themselves; a send_page_view smuggled past the types (a UMD caller) would double them.
    const untyped = {
      customParameters: { send_page_view: true },
    } as unknown as GoogleAnalyticsOptions;

    await manager({ googleAnalytics: untyped, sendPageView: false }).init();

    expect(argsOf("config")[0][2]).toEqual({ send_page_view: false });
  });

  it("sends the configuration once per page across manager instances", async () => {
    // A remount creates a second manager; the page keeps one set, one js and one config.
    await manager({ googleAnalytics: MINIMISED }).init();
    await manager({ googleAnalytics: MINIMISED }).init();

    expect(argsOf("set")).toHaveLength(1);
    expect(argsOf("config")).toHaveLength(1);
  });

  it("sends the set fields when the site's own snippet already queued config", async () => {
    // Regression: an existing `config` for the ID returned before `set`, so
    // ads_data_redaction, url_passthrough and every set field were dropped silently. They go
    // ahead of the snippet's queued commands, so its config and hits are processed under them.
    window.dataLayer.push(
      ["consent", "default", { analytics_storage: "denied" }],
      ["js", new Date()],
      ["config", GA_ID, {}]
    );

    await manager({ googleAnalytics: MINIMISED }).init();

    expect(order()).toEqual(["consent:default", "consent:update", "set", "js", "config"]);
    expect(argsOf("set")[0][1]).toMatchObject({
      ads_data_redaction: true,
      url_passthrough: true,
    });
    expect(argsOf("config")).toHaveLength(1);
  });

  it("puts the set fields ahead of a Tag Manager event queued before the manager", async () => {
    // Regression: `set` was appended after a queued `gtm.js` event, so the container could fire
    // Ads or Floodlight tags before ads_data_redaction and url_passthrough applied.
    window.dataLayer.push({ event: "gtm.js" });

    await manager({ googleAnalytics: MINIMISED }).init();

    const labels = window.dataLayer.map((entry) => {
      const command = Array.from(entry as ArrayLike<unknown>);
      if (command.length === 0) return String((entry as { event: string }).event);
      return String(command[0]) + (command[0] === "consent" ? `:${command[1]}` : "");
    });
    expect(labels).toEqual(["consent:default", "set", "gtm.js", "js", "config"]);
  });

  it("still sends its set fields beside another integration's unserialisable set", async () => {
    // The duplicate check serialises queued `set` commands; one holding a cycle must neither
    // throw out of the consent flow nor count as ours.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    window.dataLayer.push(["set", cyclic]);

    await manager({ googleAnalytics: { urlPassthrough: true } }).init();

    expect(order()).toEqual(["set", "consent:default", "set", "js", "config"]);
    expect(argsOf("set").map((c) => c[1])).toEqual([cyclic, { url_passthrough: true }]);
  });

  it("sends nothing in basic mode until the visitor allows analytics", async () => {
    const instance = manager({ consentMode: "basic", googleAnalytics: MINIMISED });

    await instance.init();
    expect(commands()).toEqual([]);

    await instance.savePreferences({ analytics: true });
    expect(order()).toEqual(["consent:default", "set", "js", "config"]);
  });

  it("deletes the _ga cookies on the configured path in basic mode before anything was queued", async () => {
    // Regression: the cookie settings were read only from the dataLayer, which is empty when a
    // stored refusal is restored in basic mode, so cookies a granted earlier page set on a
    // configured cookie_path outside this route survived the refusal.
    storeConsent(
      { categories: { analytics: false, marketing: false, functional: false }, isEU: true },
      {}
    );
    const writes: string[] = [];
    installCookieJar(
      () => cookieStore,
      (jar) => {
        cookieStore = jar;
      },
      (write) => writes.push(write)
    );

    await manager({
      consentMode: "basic",
      googleAnalytics: { config: { cookie_path: "/analytics/", cookie_prefix: "site" } },
    }).init();

    expect(commands()).toEqual([]);
    expect(
      writes.some(
        (w) =>
          w.startsWith("site_ga=;") &&
          w.includes("path=/analytics/") &&
          /expires=Thu, 01 Jan 1970/i.test(w)
      )
    ).toBe(true);
  });

  it("passes the block through the standalone initGoogleAnalytics", async () => {
    await initGoogleAnalytics(GA_ID, true, true, 0, {
      config: { allow_google_signals: false },
      urlPassthrough: true,
    });

    expect(order()).toEqual(["consent:default", "set", "js", "config"]);
    expect(argsOf("set")[0][1]).toEqual({ url_passthrough: true });
    expect(argsOf("config")[0][2]).toEqual({ allow_google_signals: false, send_page_view: true });
  });
});

describe("googleAnalytics types", () => {
  // Checked by `yarn typecheck`: each @ts-expect-error fails the build if the type accepts it.
  it("reject misspelt and mistyped documented fields", () => {
    const rejected: GoogleAnalyticsOptions[] = [
      // @ts-expect-error a misspelt documented field
      { config: { allow_google_signal: false } },
      // @ts-expect-error cookie_expires is seconds, a number
      { config: { cookie_expires: "90d" } },
      // @ts-expect-error debug_mode: false keeps debug mode on; only true is accepted
      { config: { debug_mode: false } },
      // @ts-expect-error send_page_view belongs to sendPageView
      { config: { send_page_view: true } },
      // @ts-expect-error a documented field may not bypass its type as a custom parameter
      { customParameters: { allow_google_signals: "no" } },
      // @ts-expect-error a misspelt set field
      { set: { cookie_prefx: "site" } },
    ];
    expect(rejected).toHaveLength(6);
  });
});
