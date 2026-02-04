import type { ConsentManager } from "../core/consent-manager";

/**
 * Theme mode for vanilla banner/modal components
 */
export type VanillaTheme = "light" | "dark" | "auto";

/**
 * Banner position
 */
export type BannerPosition = "bottom" | "top" | "center";

/**
 * Options for createBanner()
 */
export interface VanillaBannerOptions {
  /**
   * ConsentManager instance to connect with.
   * The banner will automatically show/hide based on manager callbacks.
   */
  manager: ConsentManager;

  /**
   * CSS selector or HTMLElement to render the banner into.
   * If not provided, a new container is created and appended to body.
   */
  container?: string | HTMLElement;

  /**
   * Theme mode.
   * - 'light': Force light theme
   * - 'dark': Force dark theme
   * - 'auto': Follow system preference (default)
   * @default 'auto'
   */
  theme?: VanillaTheme;

  /**
   * Banner position.
   * - 'bottom': Fixed to bottom of viewport (default)
   * - 'top': Fixed to top of viewport
   * - 'center': Centered modal-like dialog
   * @default 'bottom'
   */
  position?: BannerPosition;

  /**
   * Callback when user clicks Accept All
   */
  onAccept?: () => void;

  /**
   * Callback when user clicks Reject All
   */
  onReject?: () => void;

  /**
   * Callback when user clicks Customize
   */
  onCustomize?: () => void;
}

/**
 * Options for createModal()
 */
export interface VanillaModalOptions {
  /**
   * ConsentManager instance to connect with.
   * The modal will automatically show/hide based on manager callbacks.
   */
  manager: ConsentManager;

  /**
   * CSS selector or HTMLElement to render the modal into.
   * If not provided, a new container is created and appended to body.
   */
  container?: string | HTMLElement;

  /**
   * Theme mode.
   * - 'light': Force light theme
   * - 'dark': Force dark theme
   * - 'auto': Follow system preference (default)
   * @default 'auto'
   */
  theme?: VanillaTheme;

  /**
   * Callback when user saves preferences
   */
  onSave?: (categories: { analytics: boolean; marketing: boolean; functional: boolean }) => void;

  /**
   * Callback when modal is closed
   */
  onClose?: () => void;
}

/**
 * Return type for createBanner()
 */
export interface VanillaBannerInstance {
  /**
   * Show the banner
   */
  show: () => void;

  /**
   * Hide the banner
   */
  hide: () => void;

  /**
   * Check if banner is currently visible
   */
  isVisible: () => boolean;

  /**
   * Remove the banner from DOM and cleanup event listeners
   */
  destroy: () => void;
}

/**
 * Return type for createModal()
 */
export interface VanillaModalInstance {
  /**
   * Show the modal
   */
  show: () => void;

  /**
   * Hide the modal
   */
  hide: () => void;

  /**
   * Check if modal is currently visible
   */
  isVisible: () => boolean;

  /**
   * Remove the modal from DOM and cleanup event listeners
   */
  destroy: () => void;
}
