import type { Theme } from "vitepress";
import type { ConsentConfig } from "../core/types";
import { createConsentPlugin, ConsentBanner } from "../vue/index";

/**
 * VitePress theme enhancement for cookie consent
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

      // Add consent plugin
      ctx.app.use(
        createConsentPlugin({
          ...config,
          autoInit: true,
        })
      );
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
 *     app.use(createConsentPlugin({ gaId: 'G-XXX' }));
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
