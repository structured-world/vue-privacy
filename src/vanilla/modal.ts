/**
 * Vanilla JS preference center modal for non-Vue users.
 * Creates DOM elements, wires up ConsentManager callbacks, and provides show/hide API.
 */

import { getTranslations } from "../i18n/index";
import { escapeHtml } from "./utils";
import type { VanillaModalOptions, VanillaModalInstance, VanillaTheme } from "./types";

// Raw CSS string for inline injection or external stylesheet consumption.
// Hardcoded color values (#fff, #1a1a1a, etc.) are CSS var() fallbacks for browsers
// that don't support CSS custom properties or when variables aren't defined.
// This is intentional and follows CSS best practices for progressive enhancement.
export const MODAL_CSS = `/* Vue Privacy - Vanilla Modal Styles */
:root,[data-consent-theme="light"]{--consent-modal-bg:#fff;--consent-modal-text:#1a1a1a;--consent-modal-text-secondary:#666;--consent-modal-border:#e0e0e0;--consent-toggle-bg-on:#0066cc;--consent-toggle-bg-off:#ccc;--consent-link:#0066cc;--consent-btn-accept-bg:#0066cc;--consent-btn-accept-text:#fff;--consent-font:system-ui,-apple-system,sans-serif}
.consent-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box}
.consent-modal-overlay *,.consent-modal-overlay *::before,.consent-modal-overlay *::after{box-sizing:border-box}
.consent-modal-overlay--hidden{display:none}
.consent-modal{position:relative;background:var(--consent-modal-bg,#fff);color:var(--consent-modal-text,#1a1a1a);border-radius:8px;max-width:600px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.2);font-family:var(--consent-font,system-ui,-apple-system,sans-serif)}
.consent-modal__header{padding:1.5rem 3rem 1.5rem 1.5rem;border-bottom:1px solid var(--consent-modal-border,#e0e0e0)}
.consent-modal__title{margin:0 0 .5rem;font-size:1.25rem;font-weight:600;color:var(--consent-modal-text,#1a1a1a)}
.consent-modal__description{margin:0;font-size:.875rem;color:var(--consent-modal-text-secondary,#666);line-height:1.5}
.consent-modal__close{position:absolute;top:1rem;right:1rem;background:transparent;border:none;font-size:1.5rem;color:var(--consent-modal-text-secondary,#666);cursor:pointer;padding:.25rem;width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;border-radius:4px;line-height:1;font-family:inherit}
.consent-modal__close:hover{background:var(--consent-modal-border,#e0e0e0)}
.consent-modal__close:focus-visible{outline:2px solid var(--consent-link,#0066cc);outline-offset:2px}
.consent-modal__body{padding:1.5rem;overflow-y:auto;flex:1}
.consent-modal__category{margin-bottom:1.5rem;padding-bottom:1.5rem;border-bottom:1px solid var(--consent-modal-border,#e0e0e0)}
.consent-modal__category:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.consent-modal__category-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem}
.consent-modal__category-name{font-size:1rem;font-weight:600;margin:0;color:var(--consent-modal-text,#1a1a1a)}
.consent-modal__category-description{margin:0;font-size:.875rem;color:var(--consent-modal-text-secondary,#666);line-height:1.5}
.consent-toggle{position:relative;display:inline-block;width:48px;height:24px;flex-shrink:0}
.consent-toggle__input{opacity:0;width:0;height:0;position:absolute}
.consent-toggle__slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:var(--consent-toggle-bg-off,#ccc);border-radius:24px;transition:background-color .3s}
.consent-toggle__slider::before{position:absolute;content:"";height:18px;width:18px;left:3px;bottom:3px;background-color:#fff;border-radius:50%;transition:transform .3s}
.consent-toggle__input:checked+.consent-toggle__slider{background-color:var(--consent-toggle-bg-on,#0066cc)}
.consent-toggle__input:checked+.consent-toggle__slider::before{transform:translateX(24px)}
.consent-toggle__input:disabled+.consent-toggle__slider{opacity:.5;cursor:not-allowed}
.consent-toggle__input:focus-visible+.consent-toggle__slider{outline:2px solid var(--consent-link,#0066cc);outline-offset:2px}
.consent-modal__footer{padding:1.5rem;border-top:1px solid var(--consent-modal-border,#e0e0e0);display:flex;gap:.75rem;justify-content:flex-end}
.consent-modal__btn{padding:.625rem 1.25rem;font-size:.875rem;font-weight:500;border:none;border-radius:4px;cursor:pointer;transition:opacity .2s;font-family:inherit}
.consent-modal__btn:hover{opacity:.9}
.consent-modal__btn:focus-visible{outline:2px solid var(--consent-link,#0066cc);outline-offset:2px}
.consent-modal__btn--save{background:var(--consent-btn-accept-bg,#0066cc);color:var(--consent-btn-accept-text,#fff)}
.consent-modal__btn--accept-all{background:transparent;color:var(--consent-link,#0066cc);border:1px solid currentColor}
@media(max-width:640px){.consent-modal{max-width:100%;max-height:100vh;border-radius:0}.consent-modal__footer{flex-direction:column}.consent-modal__btn{width:100%;text-align:center}}
@media(prefers-color-scheme:dark){[data-consent-theme="auto"]{--consent-modal-bg:#1a1a1a;--consent-modal-text:#fff;--consent-modal-text-secondary:#a0a0a0;--consent-modal-border:#333;--consent-toggle-bg-off:#444}}
[data-consent-theme="dark"]{--consent-modal-bg:#1a1a1a;--consent-modal-text:#fff;--consent-modal-text-secondary:#a0a0a0;--consent-modal-border:#333;--consent-toggle-bg-off:#444}`;

const STYLE_ID = "vue-privacy-vanilla-modal";

/**
 * Inject modal CSS into document head (idempotent, SSR-safe)
 */
export function injectVanillaModalStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = MODAL_CSS;
  document.head.appendChild(style);
}

/**
 * Create a vanilla JS preference center modal.
 *
 * Automatically integrates with ConsentManager via callbacks.
 * Shows when manager.showPreferenceCenter() is called.
 * Hides when user saves preferences or closes the modal.
 *
 * @example
 * ```javascript
 * const manager = VuePrivacy.createConsentManager({ gaId: 'G-XXX' });
 * const modal = VuePrivacy.createModal({ manager });
 * manager.init();
 *
 * // Later, to show preferences:
 * manager.showPreferenceCenter();
 * ```
 */
// Valid values for runtime validation
const VALID_THEMES = ["light", "dark", "auto"] as const;

export function createModal(options: VanillaModalOptions): VanillaModalInstance {
  const { manager, theme = "auto", onSave, onClose } = options;

  // Runtime validation for JS users (TypeScript users get compile-time checks)
  const validatedTheme = VALID_THEMES.includes(theme as (typeof VALID_THEMES)[number])
    ? theme
    : "auto";

  // SSR guard
  if (typeof document === "undefined") {
    return {
      show: () => {},
      hide: () => {},
      isVisible: () => false,
      destroy: () => {},
    };
  }

  // Inject CSS
  injectVanillaModalStyles();

  // Resolve container
  let container: HTMLElement;
  let createdContainer = false;

  if (options.container) {
    if (typeof options.container === "string") {
      const el = document.querySelector(options.container);
      if (!el) {
        throw new Error(`createModal: container "${options.container}" not found`);
      }
      container = el as HTMLElement;
    } else {
      container = options.container;
    }
  } else {
    container = document.createElement("div");
    container.id = "vue-privacy-modal";
    document.body.appendChild(container);
    createdContainer = true;
  }

  // Get translations
  const locale = manager.getLocale();
  const t = getTranslations(locale).preferenceCenter;
  const config = manager.getConfig().preferenceCenter ?? {};

  const title = config.title ?? t.title;
  const description = config.description ?? t.description;
  const savePreferencesText = config.savePreferences ?? t.savePreferences;
  const acceptAllText = config.acceptAll ?? t.acceptAll;
  const categories = {
    necessary: {
      name: config.categories?.necessary?.name ?? t.categories.necessary.name,
      description: config.categories?.necessary?.description ?? t.categories.necessary.description,
    },
    analytics: {
      name: config.categories?.analytics?.name ?? t.categories.analytics.name,
      description: config.categories?.analytics?.description ?? t.categories.analytics.description,
    },
    marketing: {
      name: config.categories?.marketing?.name ?? t.categories.marketing.name,
      description: config.categories?.marketing?.description ?? t.categories.marketing.description,
    },
    functional: {
      name: config.categories?.functional?.name ?? t.categories.functional.name,
      description:
        config.categories?.functional?.description ?? t.categories.functional.description,
    },
  };

  // Build DOM
  const overlayEl = document.createElement("div");
  overlayEl.className = "consent-modal-overlay consent-modal-overlay--hidden";
  setThemeAttribute(overlayEl, validatedTheme);

  overlayEl.innerHTML = `
    <div class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-modal-title" tabindex="-1">
      <button type="button" class="consent-modal__close" aria-label="Close" data-action="close">&times;</button>
      <div class="consent-modal__header">
        <h2 id="consent-modal-title" class="consent-modal__title">${escapeHtml(title)}</h2>
        ${description ? `<p class="consent-modal__description">${escapeHtml(description)}</p>` : ""}
      </div>
      <div class="consent-modal__body">
        <!-- Necessary (always on) -->
        <div class="consent-modal__category">
          <div class="consent-modal__category-header">
            <h3 class="consent-modal__category-name">${escapeHtml(categories.necessary.name)}</h3>
            <label class="consent-toggle">
              <input type="checkbox" class="consent-toggle__input" checked disabled aria-label="${escapeHtml(categories.necessary.name)}">
              <span class="consent-toggle__slider"></span>
            </label>
          </div>
          <p class="consent-modal__category-description">${escapeHtml(categories.necessary.description)}</p>
        </div>
        <!-- Analytics -->
        <div class="consent-modal__category">
          <div class="consent-modal__category-header">
            <h3 class="consent-modal__category-name">${escapeHtml(categories.analytics.name)}</h3>
            <label class="consent-toggle">
              <input type="checkbox" class="consent-toggle__input" data-category="analytics" aria-label="${escapeHtml(categories.analytics.name)}">
              <span class="consent-toggle__slider"></span>
            </label>
          </div>
          <p class="consent-modal__category-description">${escapeHtml(categories.analytics.description)}</p>
        </div>
        <!-- Marketing -->
        <div class="consent-modal__category">
          <div class="consent-modal__category-header">
            <h3 class="consent-modal__category-name">${escapeHtml(categories.marketing.name)}</h3>
            <label class="consent-toggle">
              <input type="checkbox" class="consent-toggle__input" data-category="marketing" aria-label="${escapeHtml(categories.marketing.name)}">
              <span class="consent-toggle__slider"></span>
            </label>
          </div>
          <p class="consent-modal__category-description">${escapeHtml(categories.marketing.description)}</p>
        </div>
        <!-- Functional -->
        <div class="consent-modal__category">
          <div class="consent-modal__category-header">
            <h3 class="consent-modal__category-name">${escapeHtml(categories.functional.name)}</h3>
            <label class="consent-toggle">
              <input type="checkbox" class="consent-toggle__input" data-category="functional" aria-label="${escapeHtml(categories.functional.name)}">
              <span class="consent-toggle__slider"></span>
            </label>
          </div>
          <p class="consent-modal__category-description">${escapeHtml(categories.functional.description)}</p>
        </div>
      </div>
      <div class="consent-modal__footer">
        <button type="button" class="consent-modal__btn consent-modal__btn--accept-all" data-action="accept-all">
          ${escapeHtml(acceptAllText)}
        </button>
        <button type="button" class="consent-modal__btn consent-modal__btn--save" data-action="save">
          ${escapeHtml(savePreferencesText)}
        </button>
      </div>
    </div>
  `;

  container.appendChild(overlayEl);

  // Get toggle inputs
  const analyticsInput = overlayEl.querySelector('[data-category="analytics"]') as HTMLInputElement;
  const marketingInput = overlayEl.querySelector('[data-category="marketing"]') as HTMLInputElement;
  const functionalInput = overlayEl.querySelector(
    '[data-category="functional"]'
  ) as HTMLInputElement;
  const modalEl = overlayEl.querySelector(".consent-modal") as HTMLElement;

  // State
  let visible = false;

  // Load current consent state into toggles
  function loadCurrentConsent() {
    const currentConsent = manager.getConsent();
    if (currentConsent) {
      analyticsInput.checked = currentConsent.categories.analytics;
      marketingInput.checked = currentConsent.categories.marketing;
      functionalInput.checked = currentConsent.categories.functional;
    } else {
      // Default values from manager config
      const defaultCategories = manager.getConfig().categories ?? {};
      analyticsInput.checked = defaultCategories.analytics ?? false;
      marketingInput.checked = defaultCategories.marketing ?? false;
      functionalInput.checked = defaultCategories.functional ?? true;
    }
  }

  // Get current toggle values
  function getCategories() {
    return {
      analytics: analyticsInput.checked,
      marketing: marketingInput.checked,
      functional: functionalInput.checked,
    };
  }

  // Event handlers
  async function handleClick(e: Event) {
    const target = e.target as HTMLElement;
    const action = target.closest("[data-action]")?.getAttribute("data-action");

    if (action === "close") {
      hide();
      manager.getConfig().onPreferenceCenterHide?.();
      onClose?.();
    } else if (action === "accept-all") {
      await manager.acceptAll();
      onClose?.();
    } else if (action === "save") {
      const cats = getCategories();
      await manager.savePreferences(cats);
      onSave?.(cats);
    }
  }

  function handleOverlayClick(e: Event) {
    if (e.target === overlayEl) {
      hide();
      manager.getConfig().onPreferenceCenterHide?.();
      onClose?.();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Only handle keys when modal is visible
    if (!visible) return;

    if (e.key === "Escape") {
      hide();
      manager.getConfig().onPreferenceCenterHide?.();
      onClose?.();
      return;
    }

    // Focus trap: Tab cycles within this modal when focus is at boundaries.
    // Note: This traps Tab key navigation but doesn't force focus back if user
    // clicks outside. Full focus containment would require a MutationObserver
    // or focusin listener, adding complexity. The overlay click handler provides
    // an escape hatch by closing the modal if user clicks outside.
    if (e.key === "Tab") {
      const focusableElements = modalEl.querySelectorAll<HTMLElement>(
        "button, input:not(:disabled)"
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  overlayEl.addEventListener("click", handleClick);
  overlayEl.addEventListener("click", handleOverlayClick);
  // Attach keydown to document for robust focus trap even if focus escapes overlay
  document.addEventListener("keydown", handleKeydown);

  // Show/hide functions
  function show() {
    if (visible) return;
    visible = true;
    loadCurrentConsent();
    overlayEl.classList.remove("consent-modal-overlay--hidden");
    // Focus first interactive element for better keyboard UX
    const focusableElements = modalEl.querySelectorAll<HTMLElement>("button, input:not(:disabled)");
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      modalEl.focus();
    }
  }

  function hide() {
    if (!visible) return;
    visible = false;
    overlayEl.classList.add("consent-modal-overlay--hidden");
  }

  // Register callbacks with manager
  manager.onShowPreferenceCenter(show);
  manager.onHidePreferenceCenter(hide);

  // Cleanup function
  function destroy() {
    overlayEl.removeEventListener("click", handleClick);
    overlayEl.removeEventListener("click", handleOverlayClick);
    document.removeEventListener("keydown", handleKeydown);
    manager.onShowPreferenceCenter(null);
    manager.onHidePreferenceCenter(null);
    overlayEl.remove();
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
export type { VanillaModalOptions, VanillaModalInstance, VanillaTheme };
