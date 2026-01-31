const BANNER_CSS = `
.consent-banner {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 1rem;
  background: var(--consent-bg, #ffffff);
  color: var(--consent-text, #1a1a1a);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  font-family: var(--consent-font, system-ui, -apple-system, sans-serif);
}

.consent-banner--bottom {
  bottom: 0;
}

.consent-banner--top {
  top: 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.consent-banner--center {
  top: 50%;
  left: 50%;
  right: auto;
  transform: translate(-50%, -50%);
  max-width: 500px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.consent-banner__content {
  max-width: 1200px;
  margin: 0 auto;
}

.consent-banner__title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
}

.consent-banner__message {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--consent-text-secondary, #666666);
}

.consent-banner__privacy-link {
  color: var(--consent-link, #0066cc);
  text-decoration: underline;
}

.consent-banner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
  max-width: 1200px;
  margin: 0 auto;
}

.consent-banner__btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    opacity 0.2s;
}

.consent-banner__btn:hover {
  opacity: 0.9;
}

.consent-banner__btn--accept {
  background: var(--consent-btn-accept-bg, #0066cc);
  color: var(--consent-btn-accept-text, #ffffff);
}

.consent-banner__btn--reject {
  background: var(--consent-btn-reject-bg, #e0e0e0);
  color: var(--consent-btn-reject-text, #1a1a1a);
}

.consent-banner__btn--customize {
  background: transparent;
  color: var(--consent-link, #0066cc);
  border: 1px solid currentColor;
}

/* Transitions */
.consent-banner-enter-active,
.consent-banner-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.consent-banner--bottom.consent-banner-enter-from,
.consent-banner--bottom.consent-banner-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.consent-banner--top.consent-banner-enter-from,
.consent-banner--top.consent-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.consent-banner--center.consent-banner-enter-from,
.consent-banner--center.consent-banner-leave-to {
  transform: translate(-50%, -50%) scale(0.9);
  opacity: 0;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .consent-banner {
    --consent-bg: #1a1a1a;
    --consent-text: #ffffff;
    --consent-text-secondary: #a0a0a0;
    --consent-btn-reject-bg: #333333;
    --consent-btn-reject-text: #ffffff;
  }
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .consent-banner__actions {
    flex-direction: column;
  }

  .consent-banner__btn {
    width: 100%;
    justify-content: center;
  }
}
`;

const STYLE_ID = "vue-privacy-consent-banner";
let injected = false;

/** Inject ConsentBanner CSS into document head (idempotent, SSR-safe) */
export function injectBannerStyles(): void {
  if (injected || typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) {
    injected = true;
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BANNER_CSS;
  document.head.appendChild(style);
  injected = true;
}
