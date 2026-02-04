/**
 * Vanilla JS consent banner for non-Vue users.
 * Creates DOM elements, wires up ConsentManager callbacks, and provides show/hide API.
 */

import { getTranslations } from "../i18n/index";
import { escapeHtml, sanitizeUrl } from "./utils";
import type {
  VanillaBannerOptions,
  VanillaBannerInstance,
  VanillaTheme,
  BannerPosition,
} from "./types";

// Raw CSS string for inline injection or external stylesheet consumption.
// Hardcoded color values (#fff, #1a1a1a, etc.) are CSS var() fallbacks for browsers
// that don't support CSS custom properties or when variables aren't defined.
// This is intentional and follows CSS best practices for progressive enhancement.
export const BANNER_CSS = `/* Vue Privacy - Vanilla Banner Styles */
:root,[data-consent-theme="light"]{--consent-bg:#fff;--consent-text:#1a1a1a;--consent-text-secondary:#666;--consent-link:#0066cc;--consent-btn-accept-bg:#0066cc;--consent-btn-accept-text:#fff;--consent-btn-reject-bg:#e0e0e0;--consent-btn-reject-text:#1a1a1a;--consent-font:system-ui,-apple-system,sans-serif}
.consent-banner{position:fixed;left:0;right:0;z-index:9999;padding:1rem;background:var(--consent-bg,#fff);color:var(--consent-text,#1a1a1a);box-shadow:0 -2px 10px rgba(0,0,0,.1);font-family:var(--consent-font,system-ui,-apple-system,sans-serif);box-sizing:border-box}
.consent-banner *,.consent-banner *::before,.consent-banner *::after{box-sizing:border-box}
.consent-banner--bottom{bottom:0}
.consent-banner--top{top:0;box-shadow:0 2px 10px rgba(0,0,0,.1)}
.consent-banner--center{top:50%;left:50%;right:auto;transform:translate(-50%,-50%);max-width:500px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.15)}
.consent-banner__content{max-width:1200px;margin:0 auto}
.consent-banner__title{margin:0 0 .5rem;font-size:1.125rem;font-weight:600;color:var(--consent-text,#1a1a1a)}
.consent-banner__message{margin:0 0 1rem;font-size:.875rem;line-height:1.5;color:var(--consent-text-secondary,#666)}
.consent-banner__privacy-link{color:var(--consent-link,#0066cc);text-decoration:underline}
.consent-banner__privacy-link:hover{text-decoration:none}
.consent-banner__actions{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:flex-end;max-width:1200px;margin:0 auto}
.consent-banner__btn{padding:.5rem 1rem;font-size:.875rem;font-weight:500;border:none;border-radius:4px;cursor:pointer;transition:background-color .2s,opacity .2s;font-family:inherit}
.consent-banner__btn:hover{opacity:.9}
.consent-banner__btn:focus-visible{outline:2px solid var(--consent-link,#0066cc);outline-offset:2px}
.consent-banner__btn--accept{background:var(--consent-btn-accept-bg,#0066cc);color:var(--consent-btn-accept-text,#fff)}
.consent-banner__btn--reject{background:var(--consent-btn-reject-bg,#e0e0e0);color:var(--consent-btn-reject-text,#1a1a1a)}
.consent-banner__btn--customize{background:transparent;color:var(--consent-link,#0066cc);border:1px solid currentColor}
.consent-banner--hidden{display:none}
@media(max-width:640px){.consent-banner__actions{flex-direction:column}.consent-banner__btn{width:100%;text-align:center}}
@media(prefers-color-scheme:dark){[data-consent-theme="auto"]{--consent-bg:#1a1a1a;--consent-text:#fff;--consent-text-secondary:#a0a0a0;--consent-link:#66b3ff;--consent-btn-reject-bg:#333;--consent-btn-reject-text:#fff}}
[data-consent-theme="dark"]{--consent-bg:#1a1a1a;--consent-text:#fff;--consent-text-secondary:#a0a0a0;--consent-link:#66b3ff;--consent-btn-reject-bg:#333;--consent-btn-reject-text:#fff}`;

const STYLE_ID = "vue-privacy-vanilla-banner";

/**
 * Inject banner CSS into document head (idempotent, SSR-safe)
 */
export function injectVanillaBannerStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BANNER_CSS;
  document.head.appendChild(style);
}

/**
 * Create a vanilla JS consent banner.
 *
 * Automatically integrates with ConsentManager via callbacks.
 * Shows when manager.init() determines banner is needed.
 * Hides when user makes a choice.
 *
 * **Note:** Only one banner instance should be active per ConsentManager at a time.
 * If you call destroy() and then create a new banner with the same manager,
 * the new banner will work correctly. However, due to ConsentManager API limitations,
 * avoid creating multiple concurrent banner instances with the same manager.
 *
 * @example
 * ```javascript
 * const manager = VuePrivacy.createConsentManager({ gaId: 'G-XXX' });
 * const banner = VuePrivacy.createBanner({ manager });
 * manager.init();
 * ```
 */
// Valid values for runtime validation
const VALID_POSITIONS = ["bottom", "top", "center"] as const;
const VALID_THEMES = ["light", "dark", "auto"] as const;

export function createBanner(options: VanillaBannerOptions): VanillaBannerInstance {
  const { manager, theme = "auto", position = "bottom", onAccept, onReject, onCustomize } = options;

  // Runtime validation for JS users (TypeScript users get compile-time checks)
  // Runtime validation with warnings for invalid values
  const isValidPosition = VALID_POSITIONS.includes(position as (typeof VALID_POSITIONS)[number]);
  const validatedPosition = isValidPosition ? position : "bottom";
  if (!isValidPosition && position !== undefined) {
    console.warn(
      `[Vue Privacy] Invalid banner position "${String(position)}" provided. ` +
        `Falling back to "bottom". Valid positions: ${VALID_POSITIONS.join(", ")}.`
    );
  }

  const isValidTheme = VALID_THEMES.includes(theme as (typeof VALID_THEMES)[number]);
  const validatedTheme = isValidTheme ? theme : "auto";
  if (!isValidTheme && theme !== undefined) {
    console.warn(
      `[Vue Privacy] Invalid banner theme "${String(theme)}" provided. ` +
        `Falling back to "auto". Valid themes: ${VALID_THEMES.join(", ")}.`
    );
  }

  // SSR guard - warn developers since stub instance does nothing
  if (typeof document === "undefined") {
    console.warn("[Vue Privacy] createBanner called in SSR context. Returning no-op stub.");
    return {
      show: () => {},
      hide: () => {},
      isVisible: () => false,
      destroy: () => {},
    };
  }

  // Inject CSS
  injectVanillaBannerStyles();

  // Resolve container
  let container: HTMLElement;
  let createdContainer = false;

  if (options.container) {
    if (typeof options.container === "string") {
      const el = document.querySelector(options.container);
      if (!el) {
        throw new Error(`createBanner: container "${options.container}" not found`);
      }
      container = el as HTMLElement;
    } else {
      container = options.container;
    }
  } else {
    container = document.createElement("div");
    container.id = "vue-privacy-banner";
    document.body.appendChild(container);
    createdContainer = true;
  }

  // Get translations
  const locale = manager.getLocale();
  const t = getTranslations(locale).banner;
  const config = manager.getConfig().banner ?? {};

  const title = config.title ?? t.title;
  const message = config.message ?? t.message;
  const acceptAllText = config.acceptAll ?? t.acceptAll;
  const rejectAllText = config.rejectAll ?? t.rejectAll;
  const customizeText = config.customize ?? t.customize;
  const privacyLink = config.privacyLink ?? "/privacy";
  const privacyLinkText = config.privacyLinkText ?? t.privacyLinkText;

  // Build DOM
  const bannerEl = document.createElement("div");
  bannerEl.className = `consent-banner consent-banner--${validatedPosition} consent-banner--hidden`;
  bannerEl.setAttribute("role", "dialog");
  // aria-modal only appropriate for center position which blocks page interaction.
  // Bottom/top banners don't trap focus, so aria-modal would be semantically incorrect.
  if (validatedPosition === "center") {
    bannerEl.setAttribute("aria-modal", "true");
  }
  bannerEl.setAttribute("aria-labelledby", "consent-banner-title");
  bannerEl.setAttribute("aria-describedby", "consent-banner-message");
  setThemeAttribute(bannerEl, validatedTheme);

  bannerEl.innerHTML = `
    <div class="consent-banner__content">
      <h2 id="consent-banner-title" class="consent-banner__title">${escapeHtml(title)}</h2>
      <p id="consent-banner-message" class="consent-banner__message">
        ${escapeHtml(message)}
        ${privacyLink ? ` <a href="${escapeHtml(sanitizeUrl(privacyLink))}" class="consent-banner__privacy-link" target="_blank" rel="noopener">${escapeHtml(privacyLinkText)}</a>` : ""}
      </p>
    </div>
    <div class="consent-banner__actions">
      <button type="button" class="consent-banner__btn consent-banner__btn--reject" data-action="reject">
        ${escapeHtml(rejectAllText)}
      </button>
      ${customizeText ? `<button type="button" class="consent-banner__btn consent-banner__btn--customize" data-action="customize">${escapeHtml(customizeText)}</button>` : ""}
      <button type="button" class="consent-banner__btn consent-banner__btn--accept" data-action="accept">
        ${escapeHtml(acceptAllText)}
      </button>
    </div>
  `;

  container.appendChild(bannerEl);

  // State
  let visible = false;

  // Event handlers
  async function handleClick(e: Event) {
    const target = e.target as HTMLElement;
    const action = target.closest("[data-action]")?.getAttribute("data-action");

    if (action === "accept") {
      await manager.acceptAll();
      onAccept?.();
    } else if (action === "reject") {
      await manager.rejectAll();
      onReject?.();
    } else if (action === "customize") {
      manager.showPreferenceCenter();
      onCustomize?.();
    }
  }

  bannerEl.addEventListener("click", handleClick);

  // Show/hide functions
  function show() {
    if (visible) return;
    visible = true;
    bannerEl.classList.remove("consent-banner--hidden");
  }

  function hide() {
    if (!visible) return;
    visible = false;
    bannerEl.classList.add("consent-banner--hidden");
  }

  // Register callbacks with manager
  manager.onShowBanner(show);
  manager.onHideBanner(hide);

  // Cleanup function
  function destroy() {
    bannerEl.removeEventListener("click", handleClick);
    // Clear callbacks by setting to no-op functions.
    // Note: onShowBanner/onHideBanner don't accept null (unlike onShowPreferenceCenter),
    // so we use no-op functions. This is a ConsentManager API limitation.
    manager.onShowBanner(() => {});
    manager.onHideBanner(() => {});
    bannerEl.remove();
    if (createdContainer && container.parentNode) {
      container.remove();
    }
  }

  return {
    show,
    hide,
    isVisible: () => visible,
    destroy,
  };
}

/**
 * Set theme data attribute on element
 */
function setThemeAttribute(el: HTMLElement, theme: VanillaTheme): void {
  el.setAttribute("data-consent-theme", theme);
}

// Re-export types
export type { VanillaBannerOptions, VanillaBannerInstance, VanillaTheme, BannerPosition };
