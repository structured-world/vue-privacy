import type { App } from "vue";
import { watch, nextTick } from "vue";
import type { Router } from "vue-router";
import type { ConsentConfig } from "../core/types";
import { createConsentManager } from "../core/consent-manager";
import {
  createConsentPlugin as createBasePlugin,
  ConsentBanner,
  CONSENT_MANAGER_KEY,
} from "../vue/index";

/**
 * Quasar boot file for cookie consent with automatic SPA page tracking
 *
 * Automatically:
 * - Disables automatic page_view (SPA mode)
 * - Tracks initial page view after init
 * - Watches Vue Router for SPA navigation
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
 */
export function consentBoot(config: ConsentConfig) {
  return ({ app, router }: { app: App; router: Router }) => {
    const manager = createConsentManager({
      ...config,
      sendPageView: false,
    });

    // Provide manager for injection
    app.provide("consentManager", manager);
    app.provide(CONSENT_MANAGER_KEY, manager);

    // Register global component
    app.component("ConsentBanner", ConsentBanner);

    // Initialize and set up SPA tracking
    manager
      .init()
      .then(() => {
        nextTick(() => {
          manager.trackPageView(router.currentRoute.value.fullPath);
        });
      })
      .catch((err) => {
        console.error("[@structured-world/vue-privacy] Failed to initialize:", err);
      });

    // Track subsequent SPA navigations
    watch(
      () => router.currentRoute.value.fullPath,
      (path) => {
        nextTick(() => {
          manager.trackPageView(path, document.title);
        });
      }
    );
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

// Re-export types
export type { ConsentConfig } from "../core/types";
