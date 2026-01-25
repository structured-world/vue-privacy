import type { App } from "vue";
import type { ConsentConfig } from "../core/types";
import { createConsentPlugin as createBasePlugin, ConsentBanner } from "../vue/index";

/**
 * Quasar boot file for cookie consent
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
  return ({ app }: { app: App }) => {
    app.use(
      createBasePlugin({
        ...config,
        autoInit: true,
      })
    );
  };
}

/**
 * Quasar plugin (alternative to boot file)
 *
 * @example
 * ```ts
 * // quasar.config.js
 * framework: {
 *   plugins: ['Notify', 'Dialog']
 * }
 *
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
