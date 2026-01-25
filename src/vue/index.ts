import type { App, Plugin } from "vue";
import type { ConsentConfig } from "../core/types";
import { ConsentManager, createConsentManager } from "../core/consent-manager";
import ConsentBanner from "./ConsentBanner.vue";

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
 * import { createConsentPlugin } from '@structured-world/consent/vue';
 *
 * const app = createApp(App);
 * app.use(createConsentPlugin({
 *   gaId: 'G-XXXXXXXXXX',
 *   autoInit: true,
 * }));
 * ```
 */
export function createConsentPlugin(
  options: ConsentPluginOptions = {},
): Plugin {
  const { autoInit = true, ...config } = options;

  return {
    install(app: App) {
      const manager = createConsentManager(config);

      // Provide manager for injection
      app.provide("consentManager", manager);
      app.provide(CONSENT_MANAGER_KEY, manager);

      // Register global component
      app.component("ConsentBanner", ConsentBanner);

      // Auto-initialize if requested
      if (autoInit) {
        // Wait for app to mount, then initialize
        const originalMount = app.mount.bind(app);
        app.mount = (rootContainer, ...args) => {
          const result = originalMount(rootContainer, ...args);

          // Initialize after mount
          manager.init().catch((err) => {
            console.error(
              "[@structured-world/consent] Failed to initialize:",
              err,
            );
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
 * import { useConsent } from '@structured-world/consent/vue';
 *
 * const { acceptAll, rejectAll, hasConsent } = useConsent();
 * </script>
 * ```
 */
export function useConsent() {
  const manager = inject<ConsentManager>("consentManager");

  if (!manager) {
    throw new Error(
      "[@structured-world/consent] useConsent() called without plugin. " +
        "Did you forget to app.use(createConsentPlugin())?",
    );
  }

  return {
    /** Accept all cookies */
    acceptAll: () => manager.acceptAll(),
    /** Reject all non-essential cookies */
    rejectAll: () => manager.rejectAll(),
    /** Save custom preferences */
    savePreferences: (
      categories: Parameters<typeof manager.savePreferences>[0],
    ) => manager.savePreferences(categories),
    /** Get current consent state */
    getConsent: () => manager.getConsent(),
    /** Check if user has made a consent choice */
    hasConsent: () => manager.hasConsent(),
    /** Reset consent and show banner again */
    resetConsent: () => manager.resetConsent(),
    /** Check if user is detected as EU */
    isEUUser: () => manager.isEUUser(),
    /** Get the underlying manager instance */
    manager,
  };
}

// Need to import inject for useConsent
import { inject } from "vue";

// Re-export component
export { ConsentBanner };

// Re-export types
export type { ConsentConfig, ConsentManager };
