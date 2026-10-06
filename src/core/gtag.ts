import type { GoogleConsentSignals, ConsentCategories } from "./types";

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
 * How long a gtag.js element another integration added may take to run before it counts as
 * failed: long enough for a slow network, short enough that a lost load is retried this page.
 */
const EXISTING_TAG_TIMEOUT_MS = 10_000;

/**
 * gtag.js elements another integration added that failed or did not run in time. They stay on
 * the page (they are not ours to remove); a later attempt loads its own element instead of
 * waiting on them again.
 */
const stalledTags = new WeakSet<HTMLScriptElement>();

/** Commands that produce or configure hits; consent must be settled before them. */
const MEASUREMENT_COMMANDS = new Set(["js", "config", "event"]);

function commandOf(entry: unknown): ArrayLike<unknown> {
  return entry as ArrayLike<unknown>;
}

/**
 * Until the Google tag runs the dataLayer is only a queue. Moves the consent command gtag()
 * just pushed ahead of the first measurement command queued at or after `from`, so hits queued
 * earlier (by the site's own snippet, or before the choice) are processed under it. Moving the
 * entry gtag() created keeps it the Arguments object gtag.js expects.
 */
/**
 * Whether the page already holds a `consent default`, issued by another manager instance (two
 * app roots, a remount) or by the site itself. Consent Mode takes one default per page; every
 * later change has to be an update.
 */
export function hasConsentDefault(): boolean {
  if (typeof window === "undefined" || !Array.isArray(window.dataLayer)) return false;
  return window.dataLayer.some((entry) => {
    if (typeof entry !== "object" || entry === null || !("length" in entry)) return false;
    const command = commandOf(entry);
    return command[0] === "consent" && command[1] === "default";
  });
}

function isMeasurement(entry: unknown): boolean {
  if (typeof entry !== "object" || entry === null) return false;
  // Google Tag Manager's snippet and `dataLayer.push({ event })` queue plain objects, and their
  // event (the snippet's `gtm.js`) fires the container's tags just like a gtag() event.
  if (!("length" in entry) && "event" in entry) return true;
  return MEASUREMENT_COMMANDS.has(String(commandOf(entry)[0]));
}

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
    const command = commandOf(entry);
    if (command[0] === "consent" && command[1] === "default") lastDefault = i;
  });
  moveAheadOfMeasurement(lastDefault + 1);
}

/**
 * Load Google Analytics gtag.js script
 *
 * An element for this ID that is already on the page counts only once the Google tag ran;
 * while it is still downloading, this settles with it.
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
    if (matching.length > 0 && isGoogleTagLoaded()) {
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
      const timer = setTimeout(fail, EXISTING_TAG_TIMEOUT_MS);
      existing.addEventListener(
        "load",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    script.onload = () => resolve();
    script.onerror = () => {
      // A failed element would make the next attempt wait on it instead of retrying.
      script.remove();
      reject(failure());
    };

    document.head.appendChild(script);
  });
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
 * Call it once per page; later consent changes go through {@link updateConsent}, since a
 * second call issues another `consent default` and another `config` (another page_view).
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
    const command = entry as ArrayLike<unknown>;
    return command[0] === "config" && command[1] === gaId;
  });
  if (queued) return;
  window.gtag("js", new Date());
  window.gtag("config", gaId, {
    send_page_view: sendPageView,
  });
}
