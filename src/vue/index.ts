import type { App, Plugin } from "vue";
import { nextTick } from "vue";
import type { Router } from "vue-router";
import type { ConsentConfig, GA4RouteMeta } from "../core/types";
import { ConsentManager, createConsentManager } from "../core/consent-manager";
import ConsentBanner from "./ConsentBanner.vue";
import ConsentPreferenceModal from "./ConsentPreferenceModal.vue";
import type { RouterMiddlewareOptions } from "./router-middleware";

/**
 * Vue plugin options
 */
export interface ConsentPluginOptions extends ConsentConfig {
  /** Auto-initialize on plugin install */
  autoInit?: boolean;
  /** Vue Router instance for automatic SPA tracking */
  router?: Router;
  /** Router middleware options (beforeTrack, afterTrack) */
  routerMiddleware?: RouterMiddlewareOptions;
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
 * // Basic usage
 * import { createApp } from 'vue';
 * import { createConsentPlugin } from '@structured-world/vue-privacy/vue';
 *
 * const app = createApp(App);
 * app.use(createConsentPlugin({
 *   gaId: 'G-XXXXXXXXXX',
 * }));
 * ```
 *
 * @example
 * ```ts
 * // With automatic router tracking
 * import { createApp } from 'vue';
 * import { createConsentPlugin } from '@structured-world/vue-privacy/vue';
 * import router from './router';
 *
 * const app = createApp(App);
 * app.use(router);
 * app.use(createConsentPlugin({
 *   gaId: 'G-XXXXXXXXXX',
 *   router: router,  // Enables automatic page_view tracking
 *   routerMiddleware: {
 *     beforeTrack: (to) => !to.path.startsWith('/admin'),
 *   },
 * }));
 * ```
 */
export function createConsentPlugin(options: ConsentPluginOptions = {}): Plugin {
  const { autoInit = true, router, routerMiddleware, ...config } = options;

  return {
    install(app: App) {
      // Disable automatic page_view when router is provided (SPA mode)
      const manager = createConsentManager({
        ...config,
        sendPageView: router ? false : config.sendPageView,
      });

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
          manager
            .init()
            .then(() => {
              // Setup router tracking after init if router provided
              if (router) {
                setupRouterTrackingInternal(router, manager, routerMiddleware).catch((err) => {
                  console.error("[@structured-world/vue-privacy] Router tracking error:", err);
                });
              }
            })
            .catch((err) => {
              console.error("[@structured-world/vue-privacy] Failed to initialize:", err);
            });

          return result;
        };
      }
    },
  };
}

/**
 * Internal router tracking setup (used by plugin when router option is provided)
 */
async function setupRouterTrackingInternal(
  router: Router,
  manager: ConsentManager,
  options: RouterMiddlewareOptions = {}
): Promise<void> {
  const { beforeTrack, afterTrack } = options;

  // Track initial page view
  const route = router.currentRoute.value;

  // Declare before setupAfterEach() which uses it
  let initialHandled = true;

  // Apply beforeTrack to initial navigation too
  if (beforeTrack) {
    const shouldTrack = await beforeTrack(route, route);
    if (shouldTrack === false) {
      // Skip initial tracking but still setup afterEach
      setupAfterEach();
      return;
    }
  }

  const meta = route.meta as GA4RouteMeta;

  nextTick(() => {
    manager.trackPageView(route.fullPath, meta.ga4Title);

    if (meta.ga4Event) {
      manager.trackEvent(meta.ga4Event.name, meta.ga4Event.params);
      afterTrack?.(route, meta.ga4Event.name);
    } else {
      afterTrack?.(route);
    }
  });

  setupAfterEach();

  function setupAfterEach() {
    // Track subsequent navigations
    router.afterEach(async (to, from) => {
      // Skip initial navigation if already handled above
      if (initialHandled && from.fullPath === "/") {
        initialHandled = false;
        return;
      }

      // Allow user to skip tracking
      if (beforeTrack) {
        const shouldTrack = await beforeTrack(to, from);
        if (shouldTrack === false) return;
      }

      const toMeta = to.meta as GA4RouteMeta;

      nextTick(() => {
        manager.trackPageView(to.fullPath, toMeta.ga4Title);

        if (toMeta.ga4Event) {
          manager.trackEvent(toMeta.ga4Event.name, toMeta.ga4Event.params);
          afterTrack?.(to, toMeta.ga4Event.name);
        } else {
          afterTrack?.(to);
        }
      });
    });
  }
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
    /** Track view_item_list event */
    trackViewItemList: (params: Parameters<typeof manager.trackViewItemList>[0]) =>
      manager.trackViewItemList(params),
    /** Track select_item event */
    trackSelectItem: (params: Parameters<typeof manager.trackSelectItem>[0]) =>
      manager.trackSelectItem(params),
    /** Track add_shipping_info event */
    trackAddShippingInfo: (params: Parameters<typeof manager.trackAddShippingInfo>[0]) =>
      manager.trackAddShippingInfo(params),
    /** Track add_payment_info event */
    trackAddPaymentInfo: (params: Parameters<typeof manager.trackAddPaymentInfo>[0]) =>
      manager.trackAddPaymentInfo(params),
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
