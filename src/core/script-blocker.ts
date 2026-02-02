/**
 * Script blocker — blocks third-party scripts until consent is granted.
 *
 * Usage: mark scripts with type="text/plain" and data-consent-category:
 *   <script type="text/plain" data-consent-category="analytics" src="..."></script>
 *
 * When the matching category is granted, the script is replaced with an
 * executable copy. A MutationObserver catches dynamically added scripts.
 */

import type { ConsentManager } from "./consent-manager";
import type { ConsentCategories } from "./types";

type ConsentCategory = "analytics" | "marketing" | "functional";

const BLOCKED_TYPE = "text/plain";
const CATEGORY_ATTR = "data-consent-category";
const PROCESSED_ATTR = "data-consent-processed";

/**
 * Replace blocked scripts whose category has been granted.
 */
function unblockMatchingScripts(categories: Omit<ConsentCategories, "necessary">): void {
  if (typeof document === "undefined") return;

  const scripts = document.querySelectorAll<HTMLScriptElement>(
    `script[type="${BLOCKED_TYPE}"][${CATEGORY_ATTR}]:not([${PROCESSED_ATTR}])`
  );

  scripts.forEach((script) => {
    const category = script.getAttribute(CATEGORY_ATTR) as ConsentCategory | null;
    if (!category || !categories[category]) return;

    script.setAttribute(PROCESSED_ATTR, "true");

    const replacement = document.createElement("script");

    // Copy all attributes except type and processed marker
    for (const attr of Array.from(script.attributes)) {
      if (attr.name === "type" || attr.name === PROCESSED_ATTR) continue;
      replacement.setAttribute(attr.name, attr.value);
    }

    // Restore original type if specified, otherwise default to text/javascript
    const originalType = script.getAttribute("data-script-type");
    if (originalType) {
      replacement.type = originalType;
    }

    // Copy inline content
    if (!script.src && script.textContent) {
      replacement.textContent = script.textContent;
    }

    script.parentNode?.replaceChild(replacement, script);
  });
}

/**
 * Start a MutationObserver that auto-unblocks newly added blocked scripts.
 */
function observeNewScripts(
  getCategories: () => Omit<ConsentCategories, "necessary"> | null
): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    let found = false;
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (
          node.nodeName === "SCRIPT" &&
          (node as HTMLScriptElement).getAttribute("type") === BLOCKED_TYPE &&
          (node as HTMLScriptElement).hasAttribute(CATEGORY_ATTR)
        ) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (found) {
      const categories = getCategories();
      if (categories) unblockMatchingScripts(categories);
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  return observer;
}

/**
 * Initialize script blocking tied to a ConsentManager.
 * Automatically unblocks scripts when consent changes.
 *
 * @returns Cleanup function that disconnects the observer
 */
export function initScriptBlocker(manager: ConsentManager): () => void {
  let observer: MutationObserver | null = null;

  const getCategories = () => manager.getConsent()?.categories ?? null;

  // Wrap onConsentChange to trigger unblocking
  const originalCb = manager.getConfig().onConsentChange;
  (
    manager as unknown as { config: { onConsentChange: typeof originalCb } }
  ).config.onConsentChange = (consent) => {
    originalCb?.(consent);
    unblockMatchingScripts(consent.categories);
  };

  // Initial unblock pass (consent may already exist)
  const current = getCategories();
  if (current) unblockMatchingScripts(current);

  // Observe dynamic additions
  observer = observeNewScripts(getCategories);

  return () => {
    observer?.disconnect();
    observer = null;
  };
}

/**
 * Manually unblock scripts for given categories.
 * Useful for UMD/CDN users who don't use ConsentManager.
 */
export function unblockScriptsByCategory(
  categories: Partial<Omit<ConsentCategories, "necessary">>
): void {
  unblockMatchingScripts({
    analytics: categories.analytics ?? false,
    marketing: categories.marketing ?? false,
    functional: categories.functional ?? true,
  });
}
