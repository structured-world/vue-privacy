// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupRouterTracking } from "../vue/router-middleware";
import type { ConsentManager } from "../core/consent-manager";
import type { Router, RouteLocationNormalized } from "vue-router";

// Mock nextTick to be synchronous in tests
vi.mock("vue", () => ({
  nextTick: (fn: () => void) => fn(),
}));

function createMockManager(): ConsentManager {
  return {
    trackPageView: vi.fn(),
    trackEvent: vi.fn(),
  } as unknown as ConsentManager;
}

function createMockRoute(
  path: string,
  meta: Record<string, unknown> = {}
): RouteLocationNormalized {
  return {
    path,
    fullPath: path,
    meta,
    name: undefined,
    params: {},
    query: {},
    hash: "",
    matched: [],
    redirectedFrom: undefined,
  };
}

function createMockRouter(currentPath = "/"): {
  router: Router;
  triggerAfterEach: (to: RouteLocationNormalized, from: RouteLocationNormalized) => Promise<void>;
  afterEachCallbacks: Array<
    (to: RouteLocationNormalized, from: RouteLocationNormalized) => void | Promise<void>
  >;
  isReadyResolve: () => void;
} {
  const afterEachCallbacks: Array<
    (to: RouteLocationNormalized, from: RouteLocationNormalized) => void | Promise<void>
  > = [];
  let isReadyResolve: () => void = () => {};
  const isReadyPromise = new Promise<void>((resolve) => {
    isReadyResolve = resolve;
  });

  const router = {
    currentRoute: {
      value: createMockRoute(currentPath),
    },
    isReady: () => isReadyPromise,
    afterEach: (
      callback: (to: RouteLocationNormalized, from: RouteLocationNormalized) => void | Promise<void>
    ) => {
      afterEachCallbacks.push(callback);
      return () => {
        const index = afterEachCallbacks.indexOf(callback);
        if (index > -1) afterEachCallbacks.splice(index, 1);
      };
    },
  } as unknown as Router;

  const triggerAfterEach = async (to: RouteLocationNormalized, from: RouteLocationNormalized) => {
    for (const cb of afterEachCallbacks) {
      await cb(to, from);
    }
  };

  return { router, triggerAfterEach, afterEachCallbacks, isReadyResolve };
}

describe("setupRouterTracking", () => {
  let manager: ConsentManager;

  beforeEach(() => {
    manager = createMockManager();
    vi.clearAllMocks();
  });

  describe("initial page tracking", () => {
    it("tracks initial page view after router.isReady()", async () => {
      const { router, isReadyResolve } = createMockRouter("/about");

      setupRouterTracking(router, manager);

      // Before isReady resolves, no tracking
      expect(manager.trackPageView).not.toHaveBeenCalled();

      // Resolve isReady
      isReadyResolve();
      await Promise.resolve(); // flush microtasks

      expect(manager.trackPageView).toHaveBeenCalledWith("/about", undefined);
    });

    it("uses ga4Title from route meta", async () => {
      const { router, isReadyResolve } = createMockRouter("/pricing");
      (router.currentRoute.value as RouteLocationNormalized).meta = {
        ga4Title: "Pricing Page",
      };

      setupRouterTracking(router, manager);
      isReadyResolve();
      await Promise.resolve();

      expect(manager.trackPageView).toHaveBeenCalledWith("/pricing", "Pricing Page");
    });

    it("fires ga4Event from route meta", async () => {
      const { router, isReadyResolve } = createMockRouter("/signup");
      (router.currentRoute.value as RouteLocationNormalized).meta = {
        ga4Event: { name: "sign_up", params: { method: "email" } },
      };

      setupRouterTracking(router, manager);
      isReadyResolve();
      await Promise.resolve();

      expect(manager.trackEvent).toHaveBeenCalledWith("sign_up", { method: "email" });
    });

    it("skips initial tracking when trackInitial=false", async () => {
      const { router, isReadyResolve } = createMockRouter("/");

      setupRouterTracking(router, manager, { trackInitial: false });
      isReadyResolve();
      await Promise.resolve();

      expect(manager.trackPageView).not.toHaveBeenCalled();
    });
  });

  describe("beforeTrack callback", () => {
    it("skips initial tracking when beforeTrack returns false", async () => {
      const { router, isReadyResolve } = createMockRouter("/admin");
      const beforeTrack = vi.fn().mockReturnValue(false);

      setupRouterTracking(router, manager, { beforeTrack });
      isReadyResolve();
      await Promise.resolve();

      expect(beforeTrack).toHaveBeenCalled();
      expect(manager.trackPageView).not.toHaveBeenCalled();
    });

    it("skips navigation tracking when beforeTrack returns false", async () => {
      const { router, isReadyResolve, triggerAfterEach } = createMockRouter("/");
      const beforeTrack = vi.fn().mockImplementation((to) => !to.path.startsWith("/admin"));

      setupRouterTracking(router, manager, { beforeTrack });
      isReadyResolve();
      await Promise.resolve();

      // Navigate to admin (should be skipped)
      await triggerAfterEach(createMockRoute("/admin"), createMockRoute("/"));
      expect(manager.trackPageView).toHaveBeenCalledTimes(1); // Only initial

      // Navigate to regular page (should track)
      await triggerAfterEach(createMockRoute("/about"), createMockRoute("/admin"));
      expect(manager.trackPageView).toHaveBeenCalledTimes(2);
      expect(manager.trackPageView).toHaveBeenLastCalledWith("/about", undefined);
    });

    it("supports async beforeTrack callback", async () => {
      const { router, isReadyResolve } = createMockRouter("/");
      const beforeTrack = vi.fn().mockResolvedValue(true);

      setupRouterTracking(router, manager, { beforeTrack });
      isReadyResolve();
      // Need multiple microtask flushes for async beforeTrack
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(beforeTrack).toHaveBeenCalled();
      expect(manager.trackPageView).toHaveBeenCalled();
    });
  });

  describe("afterTrack callback", () => {
    it("calls afterTrack after page view", async () => {
      const { router, isReadyResolve } = createMockRouter("/");
      const afterTrack = vi.fn();

      setupRouterTracking(router, manager, { afterTrack });
      isReadyResolve();
      await Promise.resolve();

      // afterTrack is called with route and optional eventName
      expect(afterTrack).toHaveBeenCalledWith(router.currentRoute.value);
    });

    it("passes event name to afterTrack when ga4Event is present", async () => {
      const { router, isReadyResolve } = createMockRouter("/purchase");
      (router.currentRoute.value as RouteLocationNormalized).meta = {
        ga4Event: { name: "purchase" },
      };
      const afterTrack = vi.fn();

      setupRouterTracking(router, manager, { afterTrack });
      isReadyResolve();
      await Promise.resolve();

      expect(afterTrack).toHaveBeenCalledWith(router.currentRoute.value, "purchase");
    });
  });

  describe("subsequent navigation tracking", () => {
    it("tracks navigations via afterEach", async () => {
      const { router, isReadyResolve, triggerAfterEach } = createMockRouter("/");

      setupRouterTracking(router, manager);
      isReadyResolve();
      await Promise.resolve();

      // First call is initial page view via isReady
      expect(manager.trackPageView).toHaveBeenCalledTimes(1);

      // Vue Router 4's initial afterEach (to="/", from="/") - should be skipped
      await triggerAfterEach(createMockRoute("/"), createMockRoute("/"));
      await Promise.resolve();
      expect(manager.trackPageView).toHaveBeenCalledTimes(1); // Still 1

      // Now navigate to another page (to="/about", from="/")
      await triggerAfterEach(createMockRoute("/about"), createMockRoute("/"));
      await Promise.resolve();

      expect(manager.trackPageView).toHaveBeenCalledTimes(2);
      expect(manager.trackPageView).toHaveBeenLastCalledWith("/about", undefined);
    });

    it("fires ga4Event on navigation", async () => {
      const { router, isReadyResolve, triggerAfterEach } = createMockRouter("/");

      setupRouterTracking(router, manager);
      isReadyResolve();
      await Promise.resolve();

      const toRoute = createMockRoute("/checkout");
      toRoute.meta = { ga4Event: { name: "begin_checkout", params: { value: 100 } } };

      await triggerAfterEach(toRoute, createMockRoute("/cart"));

      expect(manager.trackEvent).toHaveBeenCalledWith("begin_checkout", { value: 100 });
    });

    it("skips Vue Router 4 initial afterEach when already tracked", async () => {
      const { router, isReadyResolve, triggerAfterEach } = createMockRouter("/about");

      setupRouterTracking(router, manager);
      isReadyResolve();
      await Promise.resolve();

      // Initial tracking happened via isReady()
      expect(manager.trackPageView).toHaveBeenCalledTimes(1);
      expect(manager.trackPageView).toHaveBeenCalledWith("/about", undefined);

      // Vue Router 4 fires afterEach for initial navigation with from="/"
      // This should be skipped because initialHandled is true and from="/"
      await triggerAfterEach(createMockRoute("/about"), createMockRoute("/"));
      await Promise.resolve();

      // Should NOT double-track (still 1)
      expect(manager.trackPageView).toHaveBeenCalledTimes(1);

      // Subsequent real navigation should work (initialHandled is now false)
      await triggerAfterEach(createMockRoute("/contact"), createMockRoute("/about"));
      await Promise.resolve();
      expect(manager.trackPageView).toHaveBeenCalledTimes(2);
    });

    it("tracks correct page when landing on subpage (not /)", async () => {
      // User lands directly on /pricing (not /)
      const { router, isReadyResolve, triggerAfterEach } = createMockRouter("/pricing");

      setupRouterTracking(router, manager);
      isReadyResolve();
      await Promise.resolve();

      // Should track /pricing, NOT /
      expect(manager.trackPageView).toHaveBeenCalledTimes(1);
      expect(manager.trackPageView).toHaveBeenCalledWith("/pricing", undefined);

      // Vue Router 4's initial afterEach (from="/") - skipped
      await triggerAfterEach(createMockRoute("/pricing"), createMockRoute("/"));
      await Promise.resolve();
      expect(manager.trackPageView).toHaveBeenCalledTimes(1);

      // Navigate to another page
      await triggerAfterEach(createMockRoute("/about"), createMockRoute("/pricing"));
      await Promise.resolve();
      expect(manager.trackPageView).toHaveBeenCalledTimes(2);
      expect(manager.trackPageView).toHaveBeenLastCalledWith("/about", undefined);
    });
  });
});
