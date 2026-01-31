import type { GoogleConsentSignals, ConsentCategories } from "./types";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
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
 * @param waitForUpdate - Milliseconds to wait for consent update (for async CMPs)
 */
export function setConsentDefaults(
  signals: Partial<GoogleConsentSignals>,
  waitForUpdate = 500
): void {
  initGtag();

  if (typeof window === "undefined") return;

  window.gtag("consent", "default", {
    ...signals,
    wait_for_update: waitForUpdate,
  });
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
 * Load Google Analytics gtag.js script
 *
 * @param gaId - Google Analytics measurement ID (G-XXXXXXXXXX)
 */
export function loadGtagScript(gaId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      resolve();
      return;
    }

    // Check if already loaded
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${gaId}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load gtag.js for ${gaId}`));

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
 * Initialize Google Analytics with consent defaults
 *
 * @param gaId - Google Analytics measurement ID
 * @param defaultDenied - Whether to default to denied consent (for EU users)
 * @param sendPageView - Whether to send automatic page_view (false for SPA)
 */
export async function initGoogleAnalytics(
  gaId: string,
  defaultDenied = true,
  sendPageView = true
): Promise<void> {
  initGtag();

  // Set defaults BEFORE loading script
  if (defaultDenied) {
    setConsentDefaults({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  } else {
    setConsentDefaults({
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  }

  // Load the script
  await loadGtagScript(gaId);

  // Initialize GA
  if (typeof window !== "undefined") {
    window.gtag("js", new Date());
    window.gtag("config", gaId, {
      send_page_view: sendPageView,
    });
  }
}
