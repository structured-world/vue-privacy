import type { App, Plugin } from "vue";
import type { ConsentConfig } from "../core/types";
import { ConsentManager, createConsentManager } from "../core/consent-manager";
import ConsentBanner from "./ConsentBanner.vue";
import ConsentPreferenceModal from "./ConsentPreferenceModal.vue";

/**
 * Vue plugin options
 */
export interface ConsentPluginOptions extends ConsentConfig {
  /** Auto-initialize on plugin install */
  autoInit?: boolean;
}

/**
 * Symbol for injection
 */
export const CONSENT_MANAGER_KEY = Symbol("consentManager");

/**
 * Create Vue plugin for cookie consent
 *
 * @example
 * ```ts
 * import { createApp } from 'vue';
 * import { createConsentPlugin } from '@structured-world/vue-privacy/vue';
 *
 * const app = createApp(App);
 * app.use(createConsentPlugin({
 *   gaId: 'G-XXXXXXXXXX',
 *   autoInit: true,
 * }));
 * ```
 */
export function createConsentPlugin(options: ConsentPluginOptions = {}): Plugin {
  const { autoInit = true, ...config } = options;

  return {
    install(app: App) {
      const manager = createConsentManager(config);

      // Provide manager for injection
      app.provide("consentManager", manager);
      app.provide(CONSENT_MANAGER_KEY, manager);

      // Register global components
      app.component("ConsentBanner", ConsentBanner);
      app.component("ConsentPreferenceModal", ConsentPreferenceModal);

      // Auto-initialize if requested
      if (autoInit) {
        // Wait for app to mount, then initialize
        const originalMount = app.mount.bind(app);
        app.mount = (rootContainer, ...args) => {
          const result = originalMount(rootContainer, ...args);

          // Initialize after mount
          manager.init().catch((err) => {
            console.error("[@structured-world/vue-privacy] Failed to initialize:", err);
          });

          return result;
        };
      }
    },
  };
}

/**
 * Composable to access consent manager
 *
 * @example
 * ```vue
 * <script setup>
 * import { useConsent } from '@structured-world/vue-privacy/vue';
 *
 * const { acceptAll, rejectAll, hasConsent } = useConsent();
 * </script>
 * ```
 */
export function useConsent() {
  const manager = inject<ConsentManager>("consentManager");

  if (!manager) {
    throw new Error(
      "[@structured-world/vue-privacy] useConsent() called without plugin. " +
        "Did you forget to app.use(createConsentPlugin())?"
    );
  }

  return {
    /** Accept all cookies */
    acceptAll: () => manager.acceptAll(),
    /** Reject all non-essential cookies */
    rejectAll: () => manager.rejectAll(),
    /** Save custom preferences */
    savePreferences: (categories: Parameters<typeof manager.savePreferences>[0]) =>
      manager.savePreferences(categories),
    /** Get current consent state */
    getConsent: () => manager.getConsent(),
    /** Check if user has made a consent choice */
    hasConsent: () => manager.hasConsent(),
    /** Reset consent and show banner again */
    resetConsent: () => manager.resetConsent(),
    /** Track a page view manually (for SPA navigation) */
    trackPageView: (path: string, title?: string) => manager.trackPageView(path, title),
    /** Track a custom event (GA4 recommended events, ecommerce, or custom) */
    trackEvent: (eventName: string, params?: Record<string, unknown>) =>
      manager.trackEvent(eventName, params),
    /** Track purchase event */
    trackPurchase: (params: Parameters<typeof manager.trackPurchase>[0]) =>
      manager.trackPurchase(params),
    /** Track add_to_cart event */
    trackAddToCart: (params: Parameters<typeof manager.trackAddToCart>[0]) =>
      manager.trackAddToCart(params),
    /** Track begin_checkout event */
    trackBeginCheckout: (params: Parameters<typeof manager.trackBeginCheckout>[0]) =>
      manager.trackBeginCheckout(params),
    /** Track view_item event */
    trackViewItem: (params: Parameters<typeof manager.trackViewItem>[0]) =>
      manager.trackViewItem(params),
    /** Track sign_up event */
    trackSignUp: (method?: string) => manager.trackSignUp(method),
    /** Track login event */
    trackLogin: (method?: string) => manager.trackLogin(method),
    /** Track generate_lead event */
    trackGenerateLead: (params?: Parameters<typeof manager.trackGenerateLead>[0]) =>
      manager.trackGenerateLead(params),
    /** Check if user is detected as EU */
    isEUUser: () => manager.isEUUser(),
    /** Get geo-detection result (country, method, isEU) */
    getGeoResult: () => manager.getGeoResult(),
    /** Programmatically show the preference center modal */
    showPreferenceCenter: () => manager.showPreferenceCenter(),
    /** Get the underlying manager instance */
    manager,
  };
}

// Need to import inject for useConsent
import { inject } from "vue";

// Re-export components
export { ConsentBanner, ConsentPreferenceModal };

// Re-export raw CSS for consumers with strict CSP
export { consentBannerCSS } from "./banner-styles";
export { consentModalCSS } from "./modal-styles";

// Re-export router middleware
export { setupRouterTracking } from "./router-middleware";
export type { RouterMiddlewareOptions } from "./router-middleware";

// Re-export types
export type { ConsentConfig, ConsentManager };
export type {
  GA4Item,
  GA4EcommerceParams,
  GA4PurchaseParams,
  GA4GenerateLeadParams,
  GA4RouteEvent,
  GA4RouteMeta,
} from "../core/types";
