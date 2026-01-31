// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsentManager } from "../core/consent-manager";

function createMockGeoDetector(isEU = false) {
  return {
    detect: vi.fn().mockResolvedValue({ isEU, method: "manual" as const }),
  };
}

// Mock document.cookie
let cookieStore = "";

beforeEach(() => {
  cookieStore = "";
  Object.defineProperty(document, "cookie", {
    get: () => cookieStore,
    set: (value: string) => {
      const [nameValue] = value.split(";");
      const [name] = nameValue.split("=");
      if (value.includes("1970")) {
        const cookies = cookieStore
          .split(";")
          .map((c) => c.trim())
          .filter((c) => c && !c.startsWith(`${name}=`));
        cookieStore = cookies.join("; ");
      } else {
        const cookies = cookieStore
          .split(";")
          .map((c) => c.trim())
          .filter((c) => c && !c.startsWith(`${name}=`));
        cookies.push(nameValue);
        cookieStore = cookies.join("; ");
      }
    },
    configurable: true,
  });

  // Reset script tags (gtag)
  document.head.innerHTML = "";
  vi.restoreAllMocks();
});

describe("ConsentManager with remote storage", () => {
  it("pushes consent to remote storage on acceptAll", async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("generated-uuid"),
    };

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    await manager.init();
    await manager.acceptAll();

    // Wait for fire-and-forget promise
    await vi.waitFor(() => {
      expect(mockStorage.set).toHaveBeenCalledTimes(1);
    });

    const [uid, consent] = mockStorage.set.mock.calls[0];
    expect(uid).toBeNull(); // first time, no userId
    expect(consent.categories.analytics).toBe(true);
    expect(consent.categories.marketing).toBe(true);
    expect(consent.version).toBe("1.0");
  });

  it("does not set consent_uid cookie on rejectAll", async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("reject-uuid"),
    };

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: { detect: vi.fn().mockResolvedValue({ isEU: true, method: "manual" }) },
      version: "1.0",
    });

    await manager.init();
    await manager.rejectAll();

    await vi.waitFor(() => {
      expect(mockStorage.set).toHaveBeenCalledTimes(1);
    });

    // consent_uid should NOT be set for rejected consent
    expect(cookieStore).not.toContain("consent_uid");
    // consent_preferences should NOT be set either (GDPR strict)
    expect(cookieStore).not.toContain("consent_preferences");
  });

  it("restores consent from remote storage when consent_uid cookie exists", async () => {
    // Simulate returning user with consent_uid cookie
    cookieStore = "consent_uid=existing-user-id";

    const mockStorage = {
      get: vi.fn().mockResolvedValue({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
      }),
      set: vi.fn().mockResolvedValue(null),
    };

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(),
      version: "1.0",
    });

    await manager.init();

    // Remote storage was queried with the uid
    expect(mockStorage.get).toHaveBeenCalledWith("existing-user-id", "1.0");

    // Consent was restored
    const consent = manager.getConsent();
    expect(consent).not.toBeNull();
    expect(consent!.categories.analytics).toBe(true);
  });

  it("handles remote storage errors gracefully", async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockRejectedValue(new Error("Network error")),
    };

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(),
      version: "1.0",
    });

    await manager.init();

    // Should not throw
    await manager.acceptAll();

    // Wait for fire-and-forget to complete
    await vi.waitFor(() => {
      expect(mockStorage.set).toHaveBeenCalled();
    });

    // consent_preferences cookie should still be set (local storage works)
    expect(cookieStore).toContain("consent_preferences");
  });

  it("clears consent_uid on resetConsent", async () => {
    cookieStore = "consent_uid=some-uid; consent_preferences={}";

    const manager = new ConsentManager({ version: "1.0" });
    manager.resetConsent();

    expect(cookieStore).not.toContain("consent_uid");
    expect(cookieStore).not.toContain("consent_preferences");
  });
});

describe("ConsentManager banner deferred show (bannerPending)", () => {
  it("fires callback immediately when registered after init() already requested banner", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    // init() completes before onShowBanner is registered
    await manager.init();

    const showBanner = vi.fn();
    manager.onShowBanner(showBanner);

    // Callback fires immediately because init() set bannerPending=true
    expect(showBanner).toHaveBeenCalledTimes(1);
  });

  it("fires callback via init() when registered before init()", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    const showBanner = vi.fn();
    manager.onShowBanner(showBanner);

    // Callback not yet fired — init() hasn't run
    expect(showBanner).not.toHaveBeenCalled();

    await manager.init();

    // init() calls showBannerCallback directly
    expect(showBanner).toHaveBeenCalledTimes(1);
  });

  it("does not fire callback for non-EU user", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false),
      version: "1.0",
    });

    await manager.init();

    const showBanner = vi.fn();
    manager.onShowBanner(showBanner);

    // Non-EU user: banner never shown, bannerPending stays false
    expect(showBanner).not.toHaveBeenCalled();
  });
});

describe("ConsentManager.getGeoResult()", () => {
  it("returns null before init", () => {
    const manager = new ConsentManager({ version: "1.0" });
    expect(manager.getGeoResult()).toBeNull();
  });

  it("returns full geo result for EU user after init", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: true,
        countryCode: "DE",
        method: "cloudflare" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();

    const result = manager.getGeoResult();
    expect(result).toEqual({
      isEU: true,
      countryCode: "DE",
      method: "cloudflare",
    });
  });

  it("returns full geo result for non-EU user after init", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: false,
        countryCode: "US",
        method: "api" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();

    const result = manager.getGeoResult();
    expect(result).toEqual({
      isEU: false,
      countryCode: "US",
      method: "api",
    });
  });

  it("returns null when consent restored from cookie (geo detection skipped)", async () => {
    // Pre-set consent cookie so init() takes fast-path
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: true, marketing: false, functional: true }, timestamp: Date.now(), version: "1.0" }))}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    // Geo detection was skipped — geoResult should be null
    expect(manager.getGeoResult()).toBeNull();
  });
});
