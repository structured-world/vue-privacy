import type { App } from "vue";
import { nextTick } from "vue";
import type { Router } from "vue-router";
import type { ConsentConfig, GA4RouteMeta } from "../core/types";
import { createConsentManager } from "../core/consent-manager";
import {
  createConsentPlugin as createBasePlugin,
  ConsentBanner,
  CONSENT_MANAGER_KEY,
} from "../vue/index";
import type { RouterMiddlewareOptions } from "../vue/router-middleware";

/**
 * Quasar boot options extending ConsentConfig
 */
export interface QuasarBootOptions extends ConsentConfig {
  /** Router middleware options (beforeTrack, afterTrack) */
  routerMiddleware?: RouterMiddlewareOptions;
}

/**
 * Quasar boot file for cookie consent with automatic SPA page tracking
 *
 * Automatically:
 * - Disables automatic page_view (SPA mode)
 * - Tracks initial page view after init
 * - Uses router.afterEach() for SPA navigation tracking
 * - Fires ga4Event from route meta
 *
 * @example
 * ```ts
 * // src/boot/consent.ts
 * import { boot } from 'quasar/wrappers';
 * import { consentBoot } from '@structured-world/vue-privacy/quasar';
 *
 * export default boot(consentBoot({
 *   gaId: 'G-XXXXXXXXXX',
 * }));
 * ```
 *
 * @example
 * ```ts
 * // With middleware options
 * export default boot(consentBoot({
 *   gaId: 'G-XXXXXXXXXX',
 *   routerMiddleware: {
 *     beforeTrack: (to) => !to.path.startsWith('/admin'),
 *     afterTrack: (to, eventName) => console.log('Tracked:', to.path, eventName),
 *   }
 * }));
 * ```
 */
export function consentBoot(options: QuasarBootOptions) {
  const { routerMiddleware, ...config } = options;

  return ({ app, router }: { app: App; router?: Router }) => {
    const manager = createConsentManager({
      ...config,
      sendPageView: !router,
    });

    // Provide manager for injection
    app.provide("consentManager", manager);
    app.provide(CONSENT_MANAGER_KEY, manager);

    // Register global component
    app.component("ConsentBanner", ConsentBanner);

    if (router) {
      // SPA mode: track initial page view after init and register afterEach hook
      manager
        .init()
        .then(async () => {
          const route = router.currentRoute.value;

          // Apply beforeTrack to initial navigation
          let skipInitial = false;
          if (routerMiddleware?.beforeTrack) {
            const shouldTrack = await routerMiddleware.beforeTrack(route, route);
            if (shouldTrack === false) {
              skipInitial = true;
            }
          }

          if (!skipInitial) {
            const meta = route.meta as GA4RouteMeta;

            nextTick(() => {
              // Pass ga4Title only; trackPageView falls back to document.title internally (SSR-safe)
              manager.trackPageView(route.fullPath, meta.ga4Title);

              // Fire initial ga4Event if defined
              if (meta.ga4Event) {
                manager.trackEvent(meta.ga4Event.name, meta.ga4Event.params);
                routerMiddleware?.afterTrack?.(route, meta.ga4Event.name);
              } else {
                routerMiddleware?.afterTrack?.(route);
              }
            });
          }

          // Register afterEach AFTER initial tracking is complete.
          // This prevents race condition where Vue Router 4's initial afterEach fires
          // before init() resolves, which would cause double-tracking.
          router.afterEach(async (to, from) => {
            // Allow user to skip tracking via middleware
            if (routerMiddleware?.beforeTrack) {
              const shouldTrack = await routerMiddleware.beforeTrack(to, from);
              if (shouldTrack === false) return;
            }

            const meta = to.meta as GA4RouteMeta;

            nextTick(() => {
              // Pass ga4Title only; trackPageView falls back to document.title internally (SSR-safe)
              manager.trackPageView(to.fullPath, meta.ga4Title);

              // Fire ga4Event from route meta
              if (meta.ga4Event) {
                manager.trackEvent(meta.ga4Event.name, meta.ga4Event.params);
                routerMiddleware?.afterTrack?.(to, meta.ga4Event.name);
              } else {
                routerMiddleware?.afterTrack?.(to);
              }
            });
          });
        })
        .catch((err) => {
          console.error("[@structured-world/vue-privacy] Failed to initialize:", err);
        });
    } else {
      // No router — fallback to automatic page_view from gtag
      manager.init().catch((err) => {
        console.error("[@structured-world/vue-privacy] Failed to initialize:", err);
      });
    }
  };
}

/**
 * Quasar plugin (alternative to boot file, without automatic SPA tracking)
 *
 * @example
 * ```ts
 * // main.ts
 * import { createConsentPlugin } from '@structured-world/vue-privacy/quasar';
 * app.use(createConsentPlugin({ gaId: 'G-XXX' }));
 * ```
 */
export { createBasePlugin as createConsentPlugin };

// Re-export component
export { ConsentBanner };

// Re-export composable
export { useConsent } from "../vue/index";

// Re-export router middleware
export { setupRouterTracking } from "../vue/router-middleware";
export type { RouterMiddlewareOptions } from "../vue/router-middleware";

// Re-export types
export type { ConsentConfig } from "../core/types";
export type {
  GA4Item,
  GA4EcommerceParams,
  GA4PurchaseParams,
  GA4GenerateLeadParams,
  GA4RouteEvent,
  GA4RouteMeta,
} from "../core/types";
