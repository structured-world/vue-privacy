import type { Theme } from "vitepress";
import { watch, nextTick } from "vue";
import type { ConsentConfig, GA4RouteEvent } from "../core/types";
// Note: vue/index imports vue-router types, but they're optional (peerDependenciesMeta).
// VitePress has its own router; vue-router is not required for VitePress users.
import { createConsentPlugin, ConsentBanner, CONSENT_MANAGER_KEY } from "../vue/index";
import { createConsentManager } from "../core/consent-manager";

/**
 * VitePress frontmatter fields for GA4 tracking.
 * Add these to your markdown files' frontmatter.
 *
 * @example
 * ```md
 * ---
 * ga4Title: Custom Page Title
 * ga4Event:
 *   name: sign_up
 *   params:
 *     method: docs
 * ---
 * ```
 */
export interface VitePressGA4Frontmatter {
  /** Custom page title for GA4 page_view event */
  ga4Title?: string;
  /** GA4 event to fire when page is viewed */
  ga4Event?: GA4RouteEvent;
}

/**
 * VitePress theme enhancement for cookie consent with SPA page tracking
 *
 * Automatically:
 * - Disables automatic page_view (SPA mode)
 * - Tracks initial page view after mount
 * - Watches Vue Router for SPA navigation and sends page_view events
 *
 * @example
 * ```ts
 * // docs/.vitepress/theme/index.ts
 * import DefaultTheme from 'vitepress/theme';
 * import { enhanceWithConsent } from '@structured-world/vue-privacy/vitepress';
 *
 * export default enhanceWithConsent(DefaultTheme, {
 *   gaId: 'G-XXXXXXXXXX',
 * });
 * ```
 */
export function enhanceWithConsent(theme: Theme, config: ConsentConfig): Theme {
  return {
    ...theme,
    enhanceApp(ctx) {
      // Call original enhanceApp if exists
      theme.enhanceApp?.(ctx);

      // VitePress is a SPA — always disable automatic page_view and track
      // navigation manually via router watch. User's sendPageView is ignored.
      const manager = createConsentManager({
        ...config,
        sendPageView: false,
      });

      // Provide manager for injection (same keys as createConsentPlugin)
      ctx.app.provide("consentManager", manager);
      ctx.app.provide(CONSENT_MANAGER_KEY, manager);

      // Register global component
      ctx.app.component("ConsentBanner", ConsentBanner);

      // SSR-safe browser check — avoid importing inBrowser from vitepress
      // which is not available as a named export during SSR bundle compilation
      if (typeof window !== "undefined") {
        // Initialize consent manager
        manager
          .init()
          .then(() => {
            // Track initial page view after init completes.
            // Before user choice: sent under Consent Mode defaults (cookieless).
            // After explicit denial (analytics: false): events are NOT sent.
            nextTick(() => {
              const frontmatter = ctx.router?.route.data.frontmatter as
                | VitePressGA4Frontmatter
                | undefined;
              manager.trackPageView(window.location.pathname, frontmatter?.ga4Title);

              // Fire ga4Event from frontmatter if defined
              if (frontmatter?.ga4Event) {
                manager.trackEvent(frontmatter.ga4Event.name, frontmatter.ga4Event.params);
              }
            });
          })
          .catch((err) => {
            console.error("[@structured-world/vue-privacy] Failed to initialize:", err);
          });

        // Track subsequent SPA navigations via router
        if (ctx.router) {
          watch(
            () => ctx.router.route.path,
            (path: string) => {
              // Capture frontmatter BEFORE nextTick to avoid race condition
              // (user might navigate again before nextTick fires)
              const frontmatter = ctx.router.route.data.frontmatter as
                | VitePressGA4Frontmatter
                | undefined;

              // Wait for Vue to update DOM (including document.title)
              nextTick(() => {
                manager.trackPageView(path, frontmatter?.ga4Title);

                // Fire ga4Event from frontmatter if defined
                if (frontmatter?.ga4Event) {
                  manager.trackEvent(frontmatter.ga4Event.name, frontmatter.ga4Event.params);
                }
              });
            },
            // Initial page view is tracked after init(); don't fire on watch setup
            { immediate: false }
          );
        }
      }
    },
  };
}

/**
 * VitePress composable for adding consent banner to layout
 *
 * @example
 * ```ts
 * // docs/.vitepress/theme/index.ts
 * import DefaultTheme from 'vitepress/theme';
 * import { createConsentPlugin, ConsentBanner } from '@structured-world/vue-privacy/vitepress';
 * import { h } from 'vue';
 *
 * export default {
 *   extends: DefaultTheme,
 *   enhanceApp({ app }) {
 *     app.use(createConsentPlugin({ gaId: 'G-XXX', sendPageView: false }));
 *   },
 *   Layout() {
 *     return h(DefaultTheme.Layout, null, {
 *       'layout-bottom': () => h(ConsentBanner),
 *     });
 *   },
 * };
 * ```
 */
export { createConsentPlugin, ConsentBanner };

// Re-export useConsent for convenience
export { useConsent } from "../vue/index";

// Re-export core types
export type { ConsentConfig, GA4RouteEvent } from "../core/types";
