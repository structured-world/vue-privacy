/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { unblockScriptsByCategory } from "../core/script-blocker";
import { ConsentManager } from "../core/consent-manager";

/** Helper: create a blocked script element, in `doc` (this document by default) */
function createBlockedScript(
  category: string,
  src?: string,
  inline?: string,
  doc: Document = document
): HTMLScriptElement {
  const script = doc.createElement("script");
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

  it("does NOT unblock functional scripts for a category it is not given", () => {
    // A category left out is refused, as in savePreferences(): only a grant unblocks.
    const script = createBlockedScript("functional", "https://example.com/chat.js");
    document.body.appendChild(script);

    unblockScriptsByCategory({ analytics: true });

    expect(document.querySelector('script[type="text/plain"]')).not.toBeNull();
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
        detect: vi.fn().mockResolvedValue({ consentRequired: true, method: "manual" as const }),
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

  it("keeps functional scripts blocked after rejectAll", async () => {
    // A chat widget or A/B test tagged functional is optional: "Reject all" must not run it.
    // The grant an earlier test stored would otherwise be restored by init().
    document.cookie = "consent_preferences=; max-age=0; path=/";
    const script = createBlockedScript("functional", "https://example.com/chat.js");
    document.body.appendChild(script);

    const manager = new ConsentManager({
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ consentRequired: true, method: "manual" as const }),
      },
    });

    await manager.init();
    await manager.rejectAll();

    expect(
      document.querySelector('script[data-consent-category="functional"][type="text/plain"]')
    ).not.toBeNull();
    manager.destroy();
  });

  /**
   * After the visitor accepts or refuses everything, add a blocked analytics script inside a
   * container made in `doc`, and return the type the script then has here.
   */
  async function nestedScriptType(
    choice: "acceptAll" | "rejectAll",
    doc: () => Document = () => document
  ): Promise<string | null | undefined> {
    document.cookie = "consent_preferences=; max-age=0; path=/";
    const manager = new ConsentManager({
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ consentRequired: true, method: "manual" as const }),
      },
    });
    await manager.init();
    await manager[choice]();

    const owner = doc();
    const container = owner.createElement("div");
    container.appendChild(
      createBlockedScript("analytics", "https://example.com/nested.js", undefined, owner)
    );
    document.body.appendChild(container);
    // MutationObserver callbacks run as a microtask after the insertion.
    await new Promise((resolve) => setTimeout(resolve, 0));
    manager.destroy();
    return document
      .querySelector('script[src="https://example.com/nested.js"]')
      ?.getAttribute("type");
  }

  /** A same-origin iframe's document: its nodes keep that window's prototypes when moved here. */
  function frameDocument(): Document {
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    return frame.contentDocument as Document;
  }

  // An app often inserts a component or an HTML fragment that holds the script, not the bare
  // <script>: a granted category must reach a script nested inside the added element too.
  it("unblocks a granted script added inside a container", async () => {
    expect(await nestedScriptType("acceptAll")).not.toBe("text/plain");
  });

  // A check against this window's Element class would miss a node made in an iframe.
  it("unblocks a granted script created in another window", async () => {
    expect(await nestedScriptType("acceptAll", frameDocument)).not.toBe("text/plain");
  });

  it("keeps a refused script blocked when added inside a container", async () => {
    expect(await nestedScriptType("rejectAll")).toBe("text/plain");
  });

  it("cleanup disconnects the observer", async () => {
    const manager = new ConsentManager({
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ consentRequired: false, method: "manual" as const }),
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
