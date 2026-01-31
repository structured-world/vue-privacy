import type { Theme } from "vitepress";
import { inBrowser } from "vitepress";
import { watch, nextTick } from "vue";
import type { ConsentConfig } from "../core/types";
import { createConsentPlugin, ConsentBanner, CONSENT_MANAGER_KEY } from "../vue/index";
import { createConsentManager } from "../core/consent-manager";

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

      if (inBrowser) {
        // Initialize consent manager
        manager
          .init()
          .then(() => {
            // Track initial page view after init completes.
            // For EU users with denied consent, Google Consent Mode accepts
            // the event but does not store it until consent is granted.
            nextTick(() => {
              manager.trackPageView(window.location.pathname);
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
              // Wait for Vue to update DOM (including document.title)
              nextTick(() => {
                manager.trackPageView(path);
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
export type { ConsentConfig } from "../core/types";
