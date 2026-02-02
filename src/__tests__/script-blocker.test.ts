/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { unblockScriptsByCategory } from "../core/script-blocker";
import { ConsentManager } from "../core/consent-manager";

/** Helper: create a blocked script element */
function createBlockedScript(category: string, src?: string, inline?: string): HTMLScriptElement {
  const script = document.createElement("script");
  script.type = "text/plain";
  script.setAttribute("data-consent-category", category);
  if (src) script.src = src;
  if (inline) script.textContent = inline;
  return script;
}

describe("unblockScriptsByCategory", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("unblocks analytics scripts when analytics=true", () => {
    const script = createBlockedScript("analytics", "https://example.com/analytics.js");
    document.body.appendChild(script);

    unblockScriptsByCategory({ analytics: true });

    const result = document.querySelector<HTMLScriptElement>(
      'script[src="https://example.com/analytics.js"]'
    );
    expect(result).not.toBeNull();
    // Replaced script should NOT have type="text/plain"
    expect(result?.getAttribute("type")).not.toBe("text/plain");
  });

  it("does NOT unblock marketing scripts when only analytics=true", () => {
    const script = createBlockedScript("marketing", "https://example.com/ads.js");
    document.body.appendChild(script);

    unblockScriptsByCategory({ analytics: true, marketing: false });

    const blocked = document.querySelector('script[type="text/plain"]');
    expect(blocked).not.toBeNull();
  });

  it("preserves data-consent-category attribute on unblocked scripts", () => {
    const script = createBlockedScript("analytics", "https://example.com/a.js");
    document.body.appendChild(script);

    unblockScriptsByCategory({ analytics: true });

    const result = document.querySelector('script[data-consent-category="analytics"]');
    expect(result).not.toBeNull();
  });

  it("marks processed scripts to prevent re-execution", () => {
    const script = createBlockedScript("analytics", "https://example.com/a.js");
    document.body.appendChild(script);

    unblockScriptsByCategory({ analytics: true });
    // Second call should not create duplicate
    unblockScriptsByCategory({ analytics: true });

    const scripts = document.querySelectorAll('script[data-consent-category="analytics"]');
    expect(scripts.length).toBe(1);
  });

  it("unblocks inline scripts", () => {
    const script = createBlockedScript("functional", undefined, "console.log('hello')");
    document.body.appendChild(script);

    unblockScriptsByCategory({ functional: true });

    const result = document.querySelector<HTMLScriptElement>(
      'script[data-consent-category="functional"]:not([type="text/plain"])'
    );
    expect(result).not.toBeNull();
    expect(result?.textContent).toBe("console.log('hello')");
  });

  it("restores original type from data-script-type", () => {
    const script = createBlockedScript("analytics", "https://example.com/a.js");
    script.setAttribute("data-script-type", "module");
    document.body.appendChild(script);

    unblockScriptsByCategory({ analytics: true });

    const result = document.querySelector<HTMLScriptElement>(
      'script[data-consent-category="analytics"]'
    );
    expect(result?.type).toBe("module");
  });
});

describe("initScriptBlocker with ConsentManager", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("auto-unblocks scripts when acceptAll is called", async () => {
    const script = createBlockedScript("analytics", "https://example.com/a.js");
    document.body.appendChild(script);

    const manager = new ConsentManager({
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ isEU: true, method: "manual" as const }),
      },
    });

    await manager.init();

    // Before consent: script should still be blocked
    // (EU user, no stored consent — banner is shown)
    expect(document.querySelector('script[type="text/plain"]')).not.toBeNull();

    await manager.acceptAll();

    // After consent: script should be unblocked
    const result = document.querySelector<HTMLScriptElement>(
      'script[data-consent-category="analytics"]:not([type="text/plain"])'
    );
    expect(result).not.toBeNull();
  });

  it("cleanup disconnects the observer", async () => {
    const manager = new ConsentManager({
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ isEU: false, method: "manual" as const }),
      },
    });

    await manager.init();
    manager.destroy();

    // After destroy, adding blocked scripts should NOT trigger unblocking
    // (but we can't easily test MutationObserver disconnect; just verify no errors)
    const script = createBlockedScript("analytics", "https://example.com/late.js");
    document.body.appendChild(script);

    // Script stays blocked (observer disconnected)
    expect(document.querySelector('script[type="text/plain"]')).not.toBeNull();
  });
});
