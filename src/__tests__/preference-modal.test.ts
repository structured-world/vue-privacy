/**
 * @vitest-environment jsdom
 *
 * Tests for preference center callbacks on ConsentManager.
 * Component rendering is tested indirectly via manager API since @vue/test-utils is not a dependency.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsentManager } from "../core/consent-manager";
import { injectModalStyles } from "../vue/modal-styles";

describe("ConsentManager preference center callbacks", () => {
  let manager: ConsentManager;

  beforeEach(() => {
    manager = new ConsentManager({
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ isEU: true, method: "manual" as const }),
      },
    });
  });

  it("fires showPreferenceCenter callback", () => {
    const showCb = vi.fn();
    manager.onShowPreferenceCenter(showCb);

    manager.showPreferenceCenter();

    expect(showCb).toHaveBeenCalledOnce();
  });

  it("fires onPreferenceCenterShow config callback", () => {
    const configCb = vi.fn();
    const m = new ConsentManager({
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ isEU: true, method: "manual" as const }),
      },
      onPreferenceCenterShow: configCb,
    });

    m.showPreferenceCenter();

    expect(configCb).toHaveBeenCalledOnce();
  });

  it("hides preference center on acceptAll", async () => {
    const hideCb = vi.fn();
    manager.onHidePreferenceCenter(hideCb);

    await manager.acceptAll();

    expect(hideCb).toHaveBeenCalledOnce();
  });

  it("hides preference center on rejectAll", async () => {
    const hideCb = vi.fn();
    manager.onHidePreferenceCenter(hideCb);

    await manager.rejectAll();

    expect(hideCb).toHaveBeenCalledOnce();
  });

  it("hides preference center on savePreferences", async () => {
    const hideCb = vi.fn();
    manager.onHidePreferenceCenter(hideCb);

    await manager.savePreferences({ analytics: true, marketing: false });

    expect(hideCb).toHaveBeenCalledOnce();
  });

  it("fires onPreferenceCenterHide config callback on acceptAll", async () => {
    const configCb = vi.fn();
    const m = new ConsentManager({
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ isEU: true, method: "manual" as const }),
      },
      onPreferenceCenterHide: configCb,
    });

    await m.acceptAll();

    expect(configCb).toHaveBeenCalledOnce();
  });

  it("getLocale returns configured locale", () => {
    const m = new ConsentManager({ locale: "de" });
    expect(m.getLocale()).toBe("de");
  });

  it("getLocale returns detected locale when not configured", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR");
    const m = new ConsentManager({});
    expect(m.getLocale()).toBe("fr");
  });
});

describe("injectModalStyles", () => {
  beforeEach(() => {
    const existing = document.getElementById("vue-privacy-consent-modal");
    existing?.remove();
  });

  it("injects modal CSS into document head", () => {
    injectModalStyles();

    const style = document.getElementById("vue-privacy-consent-modal");
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain(".consent-modal");
  });

  it("is idempotent (does not inject twice)", () => {
    injectModalStyles();
    injectModalStyles();

    const styles = document.querySelectorAll("#vue-privacy-consent-modal");
    expect(styles.length).toBe(1);
  });
});
