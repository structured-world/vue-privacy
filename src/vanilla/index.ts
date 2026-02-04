/**
 * Vanilla JS components for non-Vue/framework-agnostic usage.
 *
 * These components work with any HTML page via <script> tag CDN integration.
 * They automatically integrate with ConsentManager via callbacks.
 *
 * @example
 * ```html
 * <script src="https://unpkg.com/@structured-world/vue-privacy"></script>
 * <script>
 *   const manager = VuePrivacy.createConsentManager({ gaId: 'G-XXX' });
 *   const banner = VuePrivacy.createBanner({ manager });
 *   const modal = VuePrivacy.createModal({ manager });
 *   manager.init();
 * </script>
 * ```
 */

// Banner
export { createBanner, injectVanillaBannerStyles, BANNER_CSS } from "./banner";

// Modal
export { createModal, injectVanillaModalStyles, MODAL_CSS } from "./modal";

// Types
export type {
  VanillaBannerOptions,
  VanillaBannerInstance,
  VanillaModalOptions,
  VanillaModalInstance,
  VanillaTheme,
  BannerPosition,
} from "./types";
