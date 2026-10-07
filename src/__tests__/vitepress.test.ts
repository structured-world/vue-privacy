// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { reactive, nextTick } from "vue";
import type { Theme } from "vitepress";
import { enhanceWithConsent } from "../vitepress/index";

// The integration only registers the banner component and provides the manager; the .vue
// single-file components are not compiled in this test setup.
vi.mock("../vue/index", () => ({
  createConsentPlugin: vi.fn(),
  ConsentBanner: {},
  CONSENT_MANAGER_KEY: Symbol("consentManager"),
  useConsent: vi.fn(),
}));
import { storeConsent } from "../core/storage";
import type { GeoDetectionResult } from "../core/types";

type EnhanceContext = Parameters<NonNullable<Theme["enhanceApp"]>>[0];

/** The page_view events gtag() queued, by path. */
function pageViews(): unknown[] {
  return (window.dataLayer ?? [])
    .map((entry) => Array.from(entry as ArrayLike<unknown>))
    .filter((command) => command[0] === "event" && command[1] === "page_view")
    .map((command) => (command[2] as Record<string, unknown>).page_path);
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

afterEach(() => {
  document.cookie = "consent_preferences=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  window.dataLayer = [];
  delete (window as Partial<Window>).gtag;
});

describe("enhanceWithConsent", () => {
  it("counts a navigation made before init() resolved once", async () => {
    // Regression: the route watcher tracked the navigation while init() was still running,
    // and the tracking after init() counted the page in view a second time.
    storeConsent(
      { categories: { analytics: true, marketing: false, functional: true }, isEU: false },
      {}
    );
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const route = reactive({ path: "/", data: { frontmatter: {} } });
    const ctx = {
      app: { provide: () => undefined, component: () => undefined },
      router: { route },
    } as unknown as EnhanceContext;

    enhanceWithConsent({} as Theme, {
      gaId: "G-TEST123",
      consentMode: "basic",
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
    }).enhanceApp?.(ctx);

    route.path = "/guide";
    await settle();
    resolveGeo({ isEU: false, method: "manual" });
    await settle();

    expect(pageViews()).toHaveLength(1);
  });

  it("reports a failure to track the page in view instead of leaving it unhandled", async () => {
    // Regression: the tracking after init() ran in a nextTick whose promise nobody handled, so
    // an exception there became an unhandled rejection.
    const failure = new Error("frontmatter failed");
    const route = {
      path: "/",
      data: {
        get frontmatter(): never {
          throw failure;
        },
      },
    };
    const ctx = {
      app: { provide: () => undefined, component: () => undefined },
      router: { route },
    } as unknown as EnhanceContext;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      enhanceWithConsent({} as Theme, {
        gaId: "G-TEST123",
        geoDetector: { detect: () => Promise.resolve({ isEU: false, method: "manual" }) },
      }).enhanceApp?.(ctx);
      await settle();
      await settle();

      expect(error).toHaveBeenCalledWith(expect.stringContaining("track"), failure);
    } finally {
      error.mockRestore();
    }
  });

  it("counts the page in view when init() fails after a navigation", async () => {
    // Regression: the navigation made while init() ran was skipped, and a failing init() only
    // enabled tracking for later navigations, so the page in view went unmeasured.
    let resolveGeo: (result: GeoDetectionResult) => void = () => {};
    const route = reactive({ path: "/", data: { frontmatter: {} } });
    const ctx = {
      app: { provide: () => undefined, component: () => undefined },
      router: { route },
    } as unknown as EnhanceContext;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    enhanceWithConsent({} as Theme, {
      gaId: "G-TEST123",
      geoDetector: { detect: () => new Promise((resolve) => (resolveGeo = resolve)) },
      onBannerShow: () => {
        throw new Error("banner failed");
      },
    }).enhanceApp?.(ctx);

    try {
      route.path = "/guide";
      await settle();
      resolveGeo({ isEU: true, method: "manual" });
      await settle();

      expect(error).toHaveBeenCalled();
      expect(pageViews()).toHaveLength(1);
    } finally {
      error.mockRestore();
    }
  });
});
