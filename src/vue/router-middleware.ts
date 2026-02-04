import { nextTick } from "vue";
// vue-router types for router integration.
// NOTE: TypeScript still requires vue-router to be installed to resolve these types
// during compilation, even though they are type-only imports. If you use the router
// integration features, vue-router must be installed. The base consent plugin works
// without vue-router at runtime if you don't use router tracking.
import type { Router, RouteLocationNormalized } from "vue-router";
import type { ConsentManager } from "../core/consent-manager";
import type { GA4RouteMeta, GA4RouteEvent } from "../core/types";

/**
 * Options for Vue Router tracking middleware
 */
export interface RouterMiddlewareOptions {
  /**
   * Called before tracking. Return `false` to skip tracking for this navigation.
   * Useful for excluding certain routes or implementing custom logic.
   */
  beforeTrack?: (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ) => boolean | void | Promise<boolean | void>;

  /**
   * Called after tracking completes.
   * Receives the route and event name (if a ga4Event was fired).
   */
  afterTrack?: (to: RouteLocationNormalized, eventName?: string) => void;
}

/**
 * Setup automatic page and event tracking with Vue Router.
 *
 * Automatically tracks:
 * - Page views on every navigation
 * - Custom events defined in route meta (`ga4Event`)
 * - Custom page titles from route meta (`ga4Title`)
 *
 * @example
 * ```typescript
 * // main.ts
 * import { createConsentManager } from '@structured-world/vue-privacy';
 * import { setupRouterTracking } from '@structured-world/vue-privacy/vue';
 * import router from './router';
 *
 * const manager = createConsentManager({ gaId: 'G-XXX', sendPageView: false });
 * await manager.init();
 *
 * setupRouterTracking(router, manager, {
 *   beforeTrack: (to) => {
 *     // Skip tracking for admin routes
 *     if (to.path.startsWith('/admin')) return false;
 *   },
 *   afterTrack: (to, eventName) => {
 *     console.log('Tracked:', to.path, eventName);
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // router/index.ts — route with auto-event
 * const routes = [
 *   {
 *     path: '/signup/complete',
 *     component: SignupComplete,
 *     meta: {
 *       ga4Title: 'Registration Complete',
 *       ga4Event: { name: 'sign_up', params: { method: 'email' } }
 *     }
 *   }
 * ]
 * ```
 */
export function setupRouterTracking(
  router: Router,
  manager: ConsentManager,
  options: RouterMiddlewareOptions = {}
): void {
  const { beforeTrack, afterTrack } = options;

  // Track initial page view and register afterEach ONLY after router is ready.
  // This prevents race condition where Vue Router 4's initial afterEach fires
  // before isReady() resolves, which would cause double-tracking.
  router
    .isReady()
    .then(async () => {
      const route = router.currentRoute.value;

      // Apply beforeTrack to initial navigation
      let skipInitial = false;
      if (beforeTrack) {
        const shouldTrack = await beforeTrack(route, route);
        if (shouldTrack === false) {
          skipInitial = true;
        }
      }

      if (!skipInitial) {
        const meta = route.meta as GA4RouteMeta;

        nextTick(() => {
          // Pass ga4Title only; trackPageView falls back to document.title internally (SSR-safe)
          manager.trackPageView(route.fullPath, meta.ga4Title);

          if (meta.ga4Event) {
            manager.trackEvent(meta.ga4Event.name, meta.ga4Event.params);
            afterTrack?.(route, meta.ga4Event.name);
          } else {
            afterTrack?.(route);
          }
        });
      }

      // Register afterEach AFTER initial tracking is complete.
      // This ensures no race condition with Vue Router 4's initial navigation event.
      // Note: We intentionally register afterEach after beforeTrack completes. While this
      // means navigations during async beforeTrack won't be tracked, registering earlier
      // would cause Vue Router 4's initial afterEach to fire before we're ready, resulting
      // in double-tracking. The timing window is negligible in practice (app mount phase).
      router.afterEach(async (to, from) => {
        try {
          // Allow user to skip tracking
          if (beforeTrack) {
            const shouldTrack = await beforeTrack(to, from);
            if (shouldTrack === false) return;
          }

          const meta = to.meta as GA4RouteMeta;

          // Use nextTick to ensure document.title is updated by the page component
          nextTick(() => {
            // Pass ga4Title only; trackPageView falls back to document.title internally (SSR-safe)
            manager.trackPageView(to.fullPath, meta.ga4Title);

            // Fire custom event from route meta
            if (meta.ga4Event) {
              manager.trackEvent(meta.ga4Event.name, meta.ga4Event.params);
              afterTrack?.(to, meta.ga4Event.name);
            } else {
              afterTrack?.(to);
            }
          });
        } catch (err) {
          console.error("[@structured-world/vue-privacy] Router tracking error:", err);
        }
      });
    })
    .catch((err) => {
      console.error("[@structured-world/vue-privacy] Router tracking setup error:", err);
    });
}

/**
 * Type augmentation for Vue Router to support GA4RouteMeta.
 * Import this module to get type hints in route definitions.
 *
 * NOTE: This augmentation is only applicable when `vue-router` is installed
 * and available in your TypeScript project. Because this file imports
 * `vue-router` types and declares a module augmentation for `"vue-router"`,
 * you must have `vue-router` installed for type-checking of the router
 * integration to succeed.
 *
 * The base Vue plugin works without `vue-router` at runtime; only the router
 * tracking integration and these type augmentations require `vue-router`.
 *
 * @example
 * ```typescript
 * // In your router file, add:
 * import '@structured-world/vue-privacy/vue';
 *
 * // Now routes will have type hints for GA4 meta:
 * const routes = [
 *   {
 *     path: '/',
 *     meta: {
 *       ga4Title: 'Home', // TypeScript knows this!
 *       ga4Event: { name: 'page_view' }
 *     }
 *   }
 * ]
 * ```
 */
declare module "vue-router" {
  interface RouteMeta {
    /** Custom page title for GA4 page_view event */
    ga4Title?: string;
    /** GA4 event to fire on navigation */
    ga4Event?: GA4RouteEvent;
  }
}
