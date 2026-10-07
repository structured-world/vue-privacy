import type { GoogleConsentSignals, ConsentCategories } from "./types";
import { deleteCookie } from "./storage";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    /** Created by gtag.js and Google Tag Manager when they run. */
    google_tag_manager?: unknown;
  }
}

/**
 * Initialize gtag and dataLayer if not already present
 */
export function initGtag(): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag !== "function") {
    // Must use `arguments` (not rest params) — gtag.js expects Arguments objects
    // in the dataLayer, not plain Arrays. Using [...args] silently breaks collect.
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }
}

/**
 * Convert consent categories to Google Consent Mode signals
 */
export function categoriesToGoogleSignals(
  categories: Partial<Omit<ConsentCategories, "necessary">>
): GoogleConsentSignals {
  return {
    analytics_storage: categories.analytics ? "granted" : "denied",
    ad_storage: categories.marketing ? "granted" : "denied",
    ad_user_data: categories.marketing ? "granted" : "denied",
    ad_personalization: categories.marketing ? "granted" : "denied",
  };
}

/**
 * Set default consent state (should be called BEFORE loading gtag.js)
 *
 * @param signals - Consent signals to set as defaults
 * @param waitForUpdate - Milliseconds tags hold their first hits for a consent update (for
 *   async CMPs); `0` omits `wait_for_update` when the defaults are already final
 */
export function setConsentDefaults(
  signals: Partial<GoogleConsentSignals>,
  waitForUpdate = 500
): void {
  initGtag();

  if (typeof window === "undefined") return;

  window.gtag(
    "consent",
    "default",
    waitForUpdate > 0 ? { ...signals, wait_for_update: waitForUpdate } : { ...signals }
  );
}

/**
 * Whether a Google tag (gtag.js or Google Tag Manager) has already run on the page. A script
 * element alone is not enough: one still downloading has not processed any command yet.
 */
export function isGoogleTagLoaded(): boolean {
  return typeof window !== "undefined" && window.google_tag_manager !== undefined;
}

/**
 * Whether gtag.js ran for this measurement ID. The Google tag records every ID it loaded as a
 * key of `window.google_tag_manager`; the object itself is page-wide and also exists for an
 * unrelated Tag Manager container, so its presence alone says nothing about this ID.
 */
export function isTagLoadedFor(gaId: string): boolean {
  if (typeof window === "undefined") return false;
  const tags = window.google_tag_manager;
  return typeof tags === "object" && tags !== null && gaId in tags;
}

/**
 * How long a gtag.js element, another integration's or the library's own, may take to run
 * before it counts as failed: long enough for a slow network, short enough that a lost load
 * (neither load nor error ever fires) is retried on this page.
 */
const TAG_LOAD_TIMEOUT_MS = 10_000;

/**
 * gtag.js elements that did not run in time, and other integrations' elements that failed.
 * They stay on the page (a request still in flight may yet run, and another integration's
 * element is not ours to remove); a later attempt loads a new element instead of waiting on
 * them again.
 */
const stalledTags = new WeakSet<HTMLScriptElement>();

/** Commands that produce or configure hits; consent must be settled before them. */
const MEASUREMENT_COMMANDS = new Set(["js", "config", "event"]);

/**
 * The gtag() command a dataLayer entry holds, or null for a plain object pushed directly. gtag()
 * pushes its Arguments object (some snippets push arrays); an event object may carry any
 * parameter, `length` included, so having one does not make it a command.
 */
function commandOf(entry: unknown): ArrayLike<unknown> | null {
  if (Array.isArray(entry)) return entry;
  return Object.prototype.toString.call(entry) === "[object Arguments]"
    ? (entry as ArrayLike<unknown>)
    : null;
}

function isConsentDefault(entry: unknown): boolean {
  const command = commandOf(entry);
  return command !== null && command[0] === "consent" && command[1] === "default";
}

/**
 * Whether the page already holds a `consent default`, issued by another manager instance (two
 * app roots, a remount) or by the site itself. Consent Mode takes one default per page; every
 * later change has to be an update.
 */
export function hasConsentDefault(): boolean {
  if (typeof window === "undefined" || !Array.isArray(window.dataLayer)) return false;
  return window.dataLayer.some(isConsentDefault);
}

function isMeasurement(entry: unknown): boolean {
  const command = commandOf(entry);
  if (command !== null) return MEASUREMENT_COMMANDS.has(String(command[0]));
  // Google Tag Manager's snippet and `dataLayer.push({ event })` queue plain objects, and their
  // event (the snippet's `gtm.js`) fires the container's tags just like a gtag() event.
  return typeof entry === "object" && entry !== null && "event" in entry;
}

/**
 * Until the Google tag runs the dataLayer is only a queue. Moves the consent command gtag()
 * just pushed ahead of the first measurement command queued at or after `from`, so hits queued
 * earlier (by the site's own snippet, or before the choice) are processed under it. Moving the
 * entry gtag() created keeps it the Arguments object gtag.js expects.
 */
function moveAheadOfMeasurement(from: number): void {
  const queue = window.dataLayer;
  const at = queue.findIndex((entry, i) => i >= from && isMeasurement(entry));
  if (at >= 0) queue.splice(at, 0, queue.pop());
}

/**
 * Issue the page's consent defaults. Consent Mode applies defaults only before the Google tag
 * runs: when it already has, the same signals follow as an update; when it has not, the default
 * goes ahead of any measurement command already queued.
 *
 * @param signals - Initial consent signals
 * @param waitForUpdate - See {@link setConsentDefaults}
 */
export function sendInitialConsent(signals: GoogleConsentSignals, waitForUpdate = 500): void {
  const tagLoaded = isGoogleTagLoaded();
  setConsentDefaults(signals, waitForUpdate);
  if (typeof window === "undefined") return;
  if (tagLoaded) updateConsent(signals);
  else moveAheadOfMeasurement(0);
}

/**
 * Update consent state (after user makes a choice)
 *
 * @param signals - Consent signals to update
 */
export function updateConsent(signals: Partial<GoogleConsentSignals>): void {
  initGtag();

  if (typeof window === "undefined") return;

  window.gtag("consent", "update", signals);
}

/**
 * Consent update from the consent manager. Until the Google tag runs, an update pushed now
 * would be processed after the queued `config` and its page view; it goes ahead of the
 * measurement commands queued after the last consent default instead, so those hits follow the
 * latest choice and the default cannot override it.
 *
 * @param signals - Consent signals to update
 */
export function queueConsentUpdate(signals: GoogleConsentSignals): void {
  updateConsent(signals);
  if (typeof window === "undefined" || isGoogleTagLoaded()) return;
  const queue = window.dataLayer;
  let lastDefault = -1;
  queue.forEach((entry, i) => {
    if (isConsentDefault(entry)) lastDefault = i;
  });
  moveAheadOfMeasurement(lastDefault + 1);
}

/**
 * A gtag.js element fired load. gtag.js registers its measurement ID while it runs, before that
 * event; a load without it (a blocker's stand-in script) is not the tag, so the deadline stays
 * and checks once more when it expires.
 */
function settleOnLoad(
  timer: ReturnType<typeof setTimeout>,
  resolve: () => void,
  gaId: string
): void {
  if (!isTagLoadedFor(gaId)) return;
  clearTimeout(timer);
  resolve();
}

/**
 * Load Google Analytics gtag.js script
 *
 * An element for this ID that is already on the page counts only once the Google tag ran for
 * this ID; while it is still downloading, this settles with it.
 *
 * @param gaId - Google Analytics measurement ID (G-XXXXXXXXXX)
 */
export function loadGtagScript(gaId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      resolve();
      return;
    }

    const failure = () => new Error(`Failed to load gtag.js for ${gaId}`);
    const matching = Array.from(
      document.querySelectorAll<HTMLScriptElement>(
        `script[src*="googletagmanager.com/gtag/js?id=${gaId}"]`
      )
    );
    // Any element for this ID, one given up on as stalled included, may since have run: then
    // the tag is up and another element would only load it twice.
    if (matching.length > 0 && isTagLoadedFor(gaId)) {
      resolve();
      return;
    }
    const existing = matching.find((element) => !stalledTags.has(element));
    if (existing) {
      // Its load or error event may already have fired before this call, and a settled script
      // does not fire again; past the timeout it counts as failed, and a retry loads its own.
      const fail = () => {
        clearTimeout(timer);
        stalledTags.add(existing);
        reject(failure());
      };
      const timer = setTimeout(
        () => (isTagLoadedFor(gaId) ? resolve() : fail()),
        TAG_LOAD_TIMEOUT_MS
      );
      existing.addEventListener("load", () => settleOnLoad(timer, resolve, gaId), { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    // A request that neither loads nor fails would otherwise hold every later attempt forever.
    const timer = setTimeout(() => {
      if (isTagLoadedFor(gaId)) {
        resolve();
        return;
      }
      stalledTags.add(script);
      reject(failure());
    }, TAG_LOAD_TIMEOUT_MS);
    script.onload = () => settleOnLoad(timer, resolve, gaId);
    script.onerror = () => {
      clearTimeout(timer);
      // A failed element would make the next attempt wait on it instead of retrying.
      script.remove();
      reject(failure());
    };

    document.head.appendChild(script);
  });
}

/**
 * Switch Google Analytics measurement for one ID off or back on. A loaded tag under denied
 * consent still sends cookieless pings (enhanced measurement included); the `ga-disable-<ID>`
 * window property is Google's documented switch that stops the tag from sending anything for
 * that ID (developers.google.com/analytics/devguides/collection/ga4/disable-analytics).
 *
 * @param gaId - Google Analytics measurement ID (G-XXXXXXXXXX)
 * @param disabled - Whether measurement for `gaId` is off
 */
export function setAnalyticsDisabled(gaId: string, disabled: boolean): void {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = disabled;
}

/** Values gtag.js stores: `GA1.<n>.<id>.<time>` in `_ga`, `GS1.`/`GS2.` session state in `_ga_<ID>`. */
const GA_COOKIE_VALUE = /^G[AS]\d\./;

/** cookie_prefix / cookie_path / cookie_domain this page passed to the Google tag for an ID. */
function configuredCookieSettings(gaId: string): {
  prefixes: Set<string>;
  paths: Set<string>;
  domains: Set<string>;
} {
  const settings = {
    prefixes: new Set([""]),
    paths: new Set<string>(),
    domains: new Set<string>(),
  };
  if (typeof window === "undefined" || !Array.isArray(window.dataLayer)) return settings;
  for (const entry of window.dataLayer) {
    const command = commandOf(entry);
    if (command === null) continue;
    // `set` applies to every tag on the page, `config` only to the ID it names.
    const params =
      command[0] === "set"
        ? command[1]
        : command[0] === "config" && command[1] === gaId
          ? command[2]
          : null;
    if (typeof params !== "object" || params === null) continue;
    const { cookie_prefix, cookie_path, cookie_domain } = params as Record<string, unknown>;
    if (typeof cookie_prefix === "string") settings.prefixes.add(cookie_prefix);
    if (typeof cookie_path === "string") settings.paths.add(cookie_path);
    if (typeof cookie_domain === "string" && cookie_domain !== "auto" && cookie_domain !== "none") {
      settings.domains.add(cookie_domain);
    }
  }
  return settings;
}

/**
 * Delete the cookies gtag.js sets for a GA4 measurement ID: `_ga` (client ID) and
 * `_ga_<ID without "G-">` (session state), also under a `cookie_prefix` (`<prefix>_ga`,
 * `<prefix>_ga_<ID>`). The prefix, path and domain the page configured the tag with are read
 * from its `set` and `config` commands; beyond them, cookies visible here whose names end that
 * way are deleted only when their value has GA's format, so a site cookie that merely shares the
 * suffix (the consent cookie included) is kept. With the default `cookie_domain: 'auto'` the
 * cookies sit on the highest domain the browser accepts, so the deletion is issued for the host
 * and every parent domain, on "/" and every path prefix of this page; the combinations that do
 * not match are no-ops.
 *
 * @param gaId - Google Analytics measurement ID (G-XXXXXXXXXX)
 */
export function clearAnalyticsCookies(gaId: string): void {
  if (typeof document === "undefined") return;
  const session = `_ga_${gaId.replace(/^G-/, "")}`;
  const configured = configuredCookieSettings(gaId);
  const names = new Set<string>();
  for (const prefix of configured.prefixes) {
    names.add(`${prefix}_ga`);
    names.add(`${prefix}${session}`);
  }
  let jar = "";
  try {
    jar = document.cookie;
  } catch {
    // A sandboxed document has no readable cookies; the configured names are still deleted.
  }
  for (const entry of jar.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if ((name.endsWith("_ga") || name.endsWith(session)) && GA_COOKIE_VALUE.test(value)) {
      names.add(name);
    }
  }

  const labels = typeof location === "undefined" ? [] : location.hostname.split(".");
  const domains: (string | undefined)[] = [undefined, ...configured.domains];
  for (let i = 0; i < labels.length - 1; i++) domains.push(labels.slice(i).join("."));
  const paths = ["/", ...configured.paths];
  const segments = typeof location === "undefined" ? [] : location.pathname.split("/");
  for (let i = 2; i <= segments.length; i++) {
    const path = segments.slice(0, i).join("/");
    if (path !== "" && path !== "/") paths.push(path);
  }

  for (const name of names) {
    for (const path of paths) {
      for (const domain of domains) deleteCookie(name, path, domain);
    }
  }
}

/**
 * Track a page view manually (for SPA navigation)
 *
 * @param path - Page path (e.g., '/docs/guide')
 * @param title - Page title (defaults to document.title)
 */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: title ?? document.title,
  });
}

/**
 * Track a custom event (GA4 recommended events, ecommerce, or custom).
 *
 * **WARNING:** This is a low-level function that sends directly to gtag without
 * checking consent. For consent-aware tracking, use `ConsentManager.trackEvent()`
 * or the `useConsent().trackEvent()` composable instead.
 *
 * @param eventName - Event name (e.g., 'sign_up', 'purchase', 'add_to_cart')
 * @param params - Event parameters
 *
 * @example
 * ```typescript
 * // Sign up event
 * trackEvent('sign_up', { method: 'email' });
 *
 * // Purchase event
 * trackEvent('purchase', {
 *   transaction_id: 'T_12345',
 *   value: 99.99,
 *   currency: 'USD',
 *   items: [{ item_id: 'SKU_1', item_name: 'Product', price: 99.99, quantity: 1 }]
 * });
 * ```
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  if (params && Object.keys(params).length > 0) {
    window.gtag("event", eventName, params);
  } else {
    window.gtag("event", eventName);
  }
}

/**
 * Initialize Google Analytics: consent defaults, `js` and `config` queued, then the script load.
 * Call it once per page; later consent changes go through {@link updateConsent}. A second call
 * issues another `consent default`, which changes nothing once the tag has run; `js` and
 * `config` are queued only once per measurement ID, so retrying after a failed load is safe.
 *
 * @param gaId - Google Analytics measurement ID
 * @param defaults - Default consent signals, or `true` to deny all / `false` to grant all
 * @param sendPageView - Whether to send automatic page_view (false for SPA)
 * @param waitForUpdate - See {@link setConsentDefaults}; pass `0` when the defaults are final
 */
export async function initGoogleAnalytics(
  gaId: string,
  defaults: boolean | GoogleConsentSignals = true,
  sendPageView = true,
  waitForUpdate = 500
): Promise<void> {
  initGtag();

  // Set defaults BEFORE loading script
  if (typeof defaults === "boolean") {
    const value = defaults ? "denied" : "granted";
    sendInitialConsent(
      {
        analytics_storage: value,
        ad_storage: value,
        ad_user_data: value,
        ad_personalization: value,
      },
      waitForUpdate
    );
  } else {
    sendInitialConsent(defaults, waitForUpdate);
  }

  queueGoogleAnalyticsConfig(gaId, sendPageView);
  await loadGtagScript(gaId);
}

/**
 * Queue `js` and `config` right after the consent defaults, as Google's own snippet does: the
 * dataLayer is processed in order once gtag.js runs, so every later event follows `config`
 * whether the script is still loading, failed and is retried, or already ran.
 *
 * @param gaId - Google Analytics measurement ID
 * @param sendPageView - Whether `config` sends the automatic page_view
 */
export function queueGoogleAnalyticsConfig(gaId: string, sendPageView: boolean): void {
  if (typeof window === "undefined") return;
  initGtag();
  // Once per page: a retried initialisation would otherwise queue a second `config`, and
  // both are processed (two page views) once the tag loads.
  const queued = window.dataLayer.some((entry) => {
    const command = commandOf(entry);
    return command !== null && command[0] === "config" && command[1] === gaId;
  });
  if (queued) return;
  window.gtag("js", new Date());
  window.gtag("config", gaId, {
    send_page_view: sendPageView,
  });
}
