import { nextTick } from "vue";
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

  // Track whether initial navigation has been handled
  let initialHandled = false;

  // Track initial page view via isReady (preferred - ensures route is fully resolved)
  router.isReady().then(async () => {
    const route = router.currentRoute.value;

    // Apply beforeTrack to initial navigation too
    if (beforeTrack) {
      const shouldTrack = await beforeTrack(route, route);
      if (shouldTrack === false) {
        initialHandled = true;
        return;
      }
    }

    const meta = route.meta as GA4RouteMeta;
    initialHandled = true;

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
  });

  // Track subsequent navigations
  router.afterEach(async (to, from) => {
    // Skip Vue Router 4's initial navigation event if we already tracked it via isReady().
    // Vue Router 4 fires afterEach for initial load with from.fullPath="/" regardless
    // of the actual landing page. We check initialHandled to avoid double-tracking.
    if (initialHandled && from.fullPath === "/") {
      initialHandled = false;
      return;
    }

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
  });
}

/**
 * Type augmentation for Vue Router to support GA4RouteMeta.
 * Import this module to get type hints in route definitions.
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
