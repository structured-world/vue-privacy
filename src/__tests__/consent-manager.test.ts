// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsentManager, CCPA_REGIONS } from "../core/consent-manager";

function createMockGeoDetector(isEU = false, countryCode?: string, region?: string) {
  return {
    detect: vi.fn().mockResolvedValue({
      isEU,
      countryCode,
      region,
      method: "manual" as const,
    }),
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
      geoDetector: createMockGeoDetector(false), // Not in EU
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

  it("blocks remote storage restore and shows banner when user roamed to EU", async () => {
    // User has consent_uid from previous session (consent given outside EU)
    cookieStore = "consent_uid=existing-user-id";

    const mockStorage = {
      get: vi.fn().mockResolvedValue({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
      }),
      set: vi.fn().mockResolvedValue(null),
    };

    const showBanner = vi.fn();

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true, "DE"), // Now in EU!
      version: "1.0",
    });

    manager.onShowBanner(showBanner);
    await manager.init();

    // Remote storage was queried
    expect(mockStorage.get).toHaveBeenCalledWith("existing-user-id", "1.0");

    // But consent should NOT be restored (user is now in EU)
    expect(manager.hasConsent()).toBe(false);

    // consent_uid should be cleared
    expect(cookieStore).not.toContain("consent_uid");

    // Banner should be shown for GDPR disclosure
    expect(showBanner).toHaveBeenCalledTimes(1);

    // isEU should reflect current location
    expect(manager.isEUUser()).toBe(true);
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

  it("does not store consent for non-EU user on init (default state)", async () => {
    // Ensure no cookies exist before test
    cookieStore = "";

    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false),
      version: "1.0",
    });

    await manager.init();

    // Non-EU user: consent is applied but NOT stored (it's the default state)
    // No consent_preferences cookie should be set
    expect(cookieStore).not.toContain("consent_preferences");

    // But hasConsent() should return false (no stored consent)
    expect(manager.hasConsent()).toBe(false);

    // getConsent() should return null (nothing stored)
    expect(manager.getConsent()).toBeNull();
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

  it("restores EU status from stored consent cookie with geo data", async () => {
    // Pre-set consent cookie WITH geo data (new format)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        isEU: true,
        geoMethod: "cloudflare",
        countryCode: "DE",
      })
    )}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    // isEU should be restored from cookie
    expect(manager.isEUUser()).toBe(true);

    // geoResult should be reconstructed from stored data
    const geoResult = manager.getGeoResult();
    expect(geoResult).not.toBeNull();
    expect(geoResult!.isEU).toBe(true);
    expect(geoResult!.method).toBe("cloudflare");
    expect(geoResult!.countryCode).toBe("DE");
  });

  it("runs geo detection when consent restored from old cookie without geo data", async () => {
    // Pre-set consent cookie WITHOUT geo data (old format - triggers roaming check)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
      })
    )}`;

    // Mock geo detector to return non-EU (consent should be kept)
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: false,
        countryCode: "US",
        method: "api" as const,
      }),
    };

    const manager = new ConsentManager({ version: "1.0", geoDetector });
    await manager.init();

    // Geo detection should have run to check for roaming
    expect(geoDetector.detect).toHaveBeenCalled();
    // isEU should now reflect current location
    expect(manager.isEUUser()).toBe(false);
    expect(manager.getGeoResult()?.countryCode).toBe("US");
  });

  it("clears consent and shows banner when user with legacy cookie roams to EU", async () => {
    // Legacy cookie WITHOUT isEU field (pre-roaming-protection format)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        // No isEU field — legacy cookie, triggers roaming check
      })
    )}`;

    // User is now in EU (roaming scenario)
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: true,
        countryCode: "DE",
        method: "cloudflare" as const,
      }),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Consent should be cleared (user needs GDPR-compliant re-consent)
    expect(manager.hasConsent()).toBe(false);
    expect(manager.getConsent()).toBeNull();

    // Banner should be shown for GDPR disclosure
    expect(showBanner).toHaveBeenCalledTimes(1);

    // isEU should reflect current location
    expect(manager.isEUUser()).toBe(true);
    expect(manager.getGeoResult()?.countryCode).toBe("DE");
  });

  it("keeps consent when user with legacy cookie stays outside EU", async () => {
    // Legacy cookie WITHOUT isEU field (pre-roaming-protection format)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        // No isEU field — legacy cookie, triggers roaming check
      })
    )}`;

    // User is still outside EU
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: false,
        countryCode: "CA",
        method: "api" as const,
      }),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Consent should be preserved (no GDPR applies)
    expect(manager.hasConsent()).toBe(true);
    const consent = manager.getConsent();
    expect(consent).not.toBeNull();
    expect(consent!.categories.analytics).toBe(true);
    expect(consent!.categories.marketing).toBe(false);

    // Banner should NOT be shown
    expect(showBanner).not.toHaveBeenCalled();

    // isEU should reflect current location
    expect(manager.isEUUser()).toBe(false);
    expect(manager.getGeoResult()?.countryCode).toBe("CA");
  });

  it("applies consent with fail-safe when geo detection fails for legacy cookie", async () => {
    // Legacy cookie WITHOUT isEU field (pre-roaming-protection format)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        // No isEU field — legacy cookie, triggers roaming check
      })
    )}`;

    // Geo detection fails (network error, API unavailable, etc.)
    const geoDetector = {
      detect: vi.fn().mockRejectedValue(new Error("Network error")),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Geo detector WAS called (roaming check attempted)
    expect(geoDetector.detect).toHaveBeenCalled();

    // Consent should be preserved (fail-safe: keep existing consent on error)
    expect(manager.hasConsent()).toBe(true);
    const consent = manager.getConsent();
    expect(consent).not.toBeNull();
    expect(consent!.categories.analytics).toBe(true);
    expect(consent!.categories.marketing).toBe(false);

    // Banner should NOT be shown (fail-safe behavior)
    expect(showBanner).not.toHaveBeenCalled();

    // isEU is null because: legacy cookie has no isEU field to restore from,
    // and geo detection failed. The roaming check returned false (fail-safe),
    // consent was applied, and init() returned early without running main geo flow.
    expect(manager.isEUUser()).toBeNull();

    // geoDetectionLog should show the failure
    const log = manager.getGeoDetectionLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log.some((entry) => entry.status === "failed")).toBe(true);
  });

  it("clears consent and shows banner when user with isEU=false roams to EU", async () => {
    // User gave consent with explicit isEU=false (e.g., CCPA in California)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        isEU: false,
        geoMethod: "api",
        countryCode: "US",
        region: "California",
      })
    )}`;

    // User has now traveled to EU
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: true,
        countryCode: "DE",
        method: "cloudflare" as const,
      }),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Geo detector IS called for roaming check
    expect(geoDetector.detect).toHaveBeenCalled();

    // Consent should be cleared (user is now in EU, needs GDPR disclosure)
    expect(manager.hasConsent()).toBe(false);

    // Banner should be shown
    expect(showBanner).toHaveBeenCalledTimes(1);

    // isEU should reflect current location
    expect(manager.isEUUser()).toBe(true);
    expect(manager.getGeoResult()?.countryCode).toBe("DE");
  });

  it("keeps consent when user with isEU=false stays outside EU", async () => {
    // User gave consent with explicit isEU=false (e.g., CCPA in California)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        isEU: false,
        geoMethod: "api",
        countryCode: "US",
        region: "California",
      })
    )}`;

    // User is still outside EU (traveled to Canada)
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: false,
        countryCode: "CA",
        method: "api" as const,
      }),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Geo detector IS called for roaming check
    expect(geoDetector.detect).toHaveBeenCalled();

    // Consent should be preserved (still outside EU)
    expect(manager.hasConsent()).toBe(true);

    // Banner should NOT be shown
    expect(showBanner).not.toHaveBeenCalled();

    // isEU should reflect current location
    expect(manager.isEUUser()).toBe(false);
    expect(manager.getGeoResult()?.countryCode).toBe("CA");
  });
});

describe("ConsentManager.getGeoDetectionLog()", () => {
  it("returns empty array before init", () => {
    const manager = new ConsentManager({ version: "1.0" });
    expect(manager.getGeoDetectionLog()).toEqual([]);
  });

  it("returns log entry when geo detection runs", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: true,
        countryCode: "DE",
        method: "cloudflare" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();

    const log = manager.getGeoDetectionLog();
    expect(log.length).toBe(1);
    expect(log[0].method).toBe("cloudflare");
    expect(log[0].status).toBe("success");
    expect(log[0].result).toEqual({ isEU: true, countryCode: "DE" });
  });

  it("restores log entry from cookie with geo data", async () => {
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        isEU: true,
        geoMethod: "worker",
        countryCode: "FR",
      })
    )}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const log = manager.getGeoDetectionLog();
    expect(log.length).toBe(1);
    expect(log[0].method).toBe("worker");
    expect(log[0].status).toBe("success");
    expect(log[0].result).toEqual({ isEU: true, countryCode: "FR" });
  });
});

describe("ConsentManager geo data persistence", () => {
  it("stores geo data in cookie when accepting consent", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: true,
        countryCode: "IT",
        method: "api" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();
    await manager.acceptAll();

    // Parse the stored consent cookie
    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    expect(stored.isEU).toBe(true);
    expect(stored.geoMethod).toBe("api");
    expect(stored.countryCode).toBe("IT");
  });

  it("stores geo data when saving preferences", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: true,
        countryCode: "ES",
        method: "worker" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();
    await manager.savePreferences({ analytics: true, marketing: false });

    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    expect(stored.isEU).toBe(true);
    expect(stored.geoMethod).toBe("worker");
    expect(stored.countryCode).toBe("ES");
  });

  it("stores geo data for non-EU user who explicitly saves preferences", async () => {
    // Non-EU users normally get automatic "accept all" without storing consent.
    // But if they visit preference center and save custom preferences,
    // the geo data (isEU=false) should be persisted.
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        isEU: false,
        countryCode: "US",
        method: "api" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();

    // Non-EU user explicitly changes preferences through preference center
    await manager.savePreferences({ analytics: true, marketing: false });

    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    // Geo data should be stored even for non-EU users
    expect(stored.isEU).toBe(false);
    expect(stored.geoMethod).toBe("api");
    expect(stored.countryCode).toBe("US");
  });
});

describe("ConsentManager.trackEvent()", () => {
  it("sends event when analytics consent is granted", async () => {
    // Pre-set consent with analytics=true
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: true, marketing: false, functional: true }, timestamp: Date.now(), version: "1.0" }))}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    // Mock gtag
    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackEvent("sign_up", { method: "email" });

    expect(gtagCalls).toContainEqual(["event", "sign_up", { method: "email" }]);
  });

  it("does not send event when analytics consent is denied", async () => {
    // Pre-set consent with analytics=false and isEU=true (EU consent is valid everywhere)
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: false, marketing: false, functional: true }, timestamp: Date.now(), version: "1.0", isEU: true }))}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    // Mock gtag
    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackEvent("sign_up", { method: "email" });

    // No event should be sent
    expect(gtagCalls.filter((c) => c[0] === "event" && c[1] === "sign_up")).toHaveLength(0);
  });

  it("sends event without params", async () => {
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: true, marketing: false, functional: true }, timestamp: Date.now(), version: "1.0" }))}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackEvent("test_event");

    expect(gtagCalls).toContainEqual(["event", "test_event"]);
  });
});

describe("ConsentManager ecommerce helpers", () => {
  beforeEach(async () => {
    // Pre-set consent with analytics=true
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: true, marketing: true, functional: true }, timestamp: Date.now(), version: "1.0" }))}`;
  });

  it("trackPurchase sends purchase event with correct params", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackPurchase({
      transaction_id: "ORDER_123",
      currency: "USD",
      value: 99.99,
      shipping: 5.99,
      items: [{ item_id: "SKU_1", item_name: "Widget", price: 99.99, quantity: 1 }],
    });

    const purchaseCall = gtagCalls.find((c) => c[1] === "purchase");
    expect(purchaseCall).toBeDefined();
    expect(purchaseCall![2]).toMatchObject({
      transaction_id: "ORDER_123",
      currency: "USD",
      value: 99.99,
      shipping: 5.99,
    });
  });

  it("trackAddToCart sends add_to_cart event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackAddToCart({
      currency: "USD",
      value: 29.99,
      items: [{ item_id: "SKU_2", item_name: "Gadget", price: 29.99 }],
    });

    const addToCartCall = gtagCalls.find((c) => c[1] === "add_to_cart");
    expect(addToCartCall).toBeDefined();
    expect(addToCartCall![2]).toMatchObject({
      currency: "USD",
      value: 29.99,
    });
  });

  it("trackBeginCheckout sends begin_checkout event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackBeginCheckout({
      currency: "EUR",
      value: 50,
      coupon: "SAVE10",
      items: [{ item_id: "SKU_3", item_name: "Product", price: 50 }],
    });

    const checkoutCall = gtagCalls.find((c) => c[1] === "begin_checkout");
    expect(checkoutCall).toBeDefined();
    expect(checkoutCall![2]).toMatchObject({
      currency: "EUR",
      value: 50,
      coupon: "SAVE10",
    });
  });

  it("trackSignUp sends sign_up event with method", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackSignUp("google");

    const signUpCall = gtagCalls.find((c) => c[1] === "sign_up");
    expect(signUpCall).toBeDefined();
    expect(signUpCall![2]).toEqual({ method: "google" });
  });

  it("trackSignUp sends sign_up event without method", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackSignUp();

    const signUpCall = gtagCalls.find((c) => c[1] === "sign_up");
    expect(signUpCall).toEqual(["event", "sign_up"]);
  });

  it("trackLogin sends login event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackLogin("email");

    const loginCall = gtagCalls.find((c) => c[1] === "login");
    expect(loginCall).toBeDefined();
    expect(loginCall![2]).toEqual({ method: "email" });
  });

  it("trackGenerateLead sends generate_lead event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackGenerateLead({ value: 100, currency: "USD" });

    const leadCall = gtagCalls.find((c) => c[1] === "generate_lead");
    expect(leadCall).toBeDefined();
    expect(leadCall![2]).toMatchObject({
      value: 100,
      currency: "USD",
    });
  });

  it("trackViewItem sends view_item event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackViewItem({
      currency: "USD",
      value: 19.99,
      items: [{ item_id: "SKU_4", item_name: "Book", price: 19.99 }],
    });

    const viewItemCall = gtagCalls.find((c) => c[1] === "view_item");
    expect(viewItemCall).toBeDefined();
  });

  it("trackViewItemList sends view_item_list event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackViewItemList({
      currency: "USD",
      item_list_id: "category_shirts",
      item_list_name: "T-Shirts",
      items: [
        { item_id: "SKU_5", item_name: "Red Shirt", price: 29.99 },
        { item_id: "SKU_6", item_name: "Blue Shirt", price: 29.99 },
      ],
    });

    const call = gtagCalls.find((c) => c[1] === "view_item_list");
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({
      currency: "USD",
      item_list_id: "category_shirts",
      item_list_name: "T-Shirts",
    });
  });

  it("trackSelectItem sends select_item event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackSelectItem({
      currency: "USD",
      item_list_id: "search_results",
      items: [{ item_id: "SKU_7", item_name: "Selected Product", price: 49.99, index: 3 }],
    });

    const call = gtagCalls.find((c) => c[1] === "select_item");
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({
      currency: "USD",
      item_list_id: "search_results",
    });
  });

  it("trackAddShippingInfo sends add_shipping_info event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackAddShippingInfo({
      currency: "USD",
      value: 75.0,
      shipping_tier: "Express",
      items: [{ item_id: "SKU_8", item_name: "Laptop Stand", price: 75.0 }],
    });

    const call = gtagCalls.find((c) => c[1] === "add_shipping_info");
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({
      currency: "USD",
      value: 75.0,
      shipping_tier: "Express",
    });
  });

  it("trackAddPaymentInfo sends add_payment_info event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackAddPaymentInfo({
      currency: "EUR",
      value: 120.0,
      payment_type: "Credit Card",
      items: [{ item_id: "SKU_9", item_name: "Headphones", price: 120.0 }],
    });

    const call = gtagCalls.find((c) => c[1] === "add_payment_info");
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({
      currency: "EUR",
      value: 120.0,
      payment_type: "Credit Card",
    });
  });
});

describe("CCPA_REGIONS constant", () => {
  // CCPA_REGIONS stores lowercase values for case-insensitive matching
  it("includes California (lowercase)", () => {
    expect(CCPA_REGIONS.has("california")).toBe(true);
    expect(CCPA_REGIONS.has("ca")).toBe(true);
  });

  it("includes Virginia (lowercase)", () => {
    expect(CCPA_REGIONS.has("virginia")).toBe(true);
    expect(CCPA_REGIONS.has("va")).toBe(true);
  });

  it("includes Colorado (lowercase)", () => {
    expect(CCPA_REGIONS.has("colorado")).toBe(true);
    expect(CCPA_REGIONS.has("co")).toBe(true);
  });

  it("includes Connecticut (lowercase)", () => {
    expect(CCPA_REGIONS.has("connecticut")).toBe(true);
    expect(CCPA_REGIONS.has("ct")).toBe(true);
  });

  it("includes Utah (lowercase)", () => {
    expect(CCPA_REGIONS.has("utah")).toBe(true);
    expect(CCPA_REGIONS.has("ut")).toBe(true);
  });

  it("does not include non-CCPA states", () => {
    expect(CCPA_REGIONS.has("texas")).toBe(false);
    expect(CCPA_REGIONS.has("tx")).toBe(false);
    expect(CCPA_REGIONS.has("new york")).toBe(false);
    expect(CCPA_REGIONS.has("ny")).toBe(false);
  });
});

describe("ConsentManager.isCCPAUser()", () => {
  it("returns false when ccpaEnabled is not set", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns false when ccpaEnabled is false", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: false,
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns true for California user when ccpaEnabled", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(true);
  });

  it("returns true for CA abbreviation when ccpaEnabled", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "CA"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(true);
  });

  it("returns true for Virginia user when ccpaEnabled", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "Virginia"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(true);
  });

  it("handles case-insensitive region matching", async () => {
    // Test uppercase from geo API
    const managerUpper = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "CALIFORNIA"),
      version: "1.0",
    });
    await managerUpper.init();
    expect(managerUpper.isCCPAUser()).toBe(true);

    // Test lowercase
    const managerLower = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "california"),
      version: "1.0",
    });
    await managerLower.init();
    expect(managerLower.isCCPAUser()).toBe(true);

    // Test mixed case
    const managerMixed = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "CaLiFoRnIa"),
      version: "1.0",
    });
    await managerMixed.init();
    expect(managerMixed.isCCPAUser()).toBe(true);
  });

  it("returns false for non-CCPA US state", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "Texas"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns false for non-US country", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "CA", "Ontario"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns false when region is not provided", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns false before init()", () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      version: "1.0",
    });

    expect(manager.isCCPAUser()).toBe(false);
  });
});

describe("ConsentManager.getRegion()", () => {
  it("returns undefined before init()", () => {
    const manager = new ConsentManager({ version: "1.0" });
    expect(manager.getRegion()).toBeUndefined();
  });

  it("returns region after init()", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.getRegion()).toBe("California");
  });

  it("returns undefined when region not in geo result", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.getRegion()).toBeUndefined();
  });
});

describe("ConsentManager CCPA flow", () => {
  it("grants consent silently for CCPA user (no banner)", async () => {
    const showBanner = vi.fn();
    const onCCPAUser = vi.fn();

    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
      onCCPAUser,
    });

    manager.onShowBanner(showBanner);
    await manager.init();

    // Banner should NOT be shown for CCPA users
    expect(showBanner).not.toHaveBeenCalled();
    // onCCPAUser callback should be called
    expect(onCCPAUser).toHaveBeenCalledTimes(1);
  });

  it("shows banner for EU user even when ccpaEnabled", async () => {
    const showBanner = vi.fn();

    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(true, "DE"),
      version: "1.0",
    });

    manager.onShowBanner(showBanner);
    await manager.init();

    // EU takes precedence — banner should be shown
    expect(showBanner).toHaveBeenCalledTimes(1);
  });

  it("does not call onCCPAUser for EU user", async () => {
    const onCCPAUser = vi.fn();

    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(true, "DE"),
      version: "1.0",
      onCCPAUser,
    });

    await manager.init();

    expect(onCCPAUser).not.toHaveBeenCalled();
  });

  it("does not call onCCPAUser for non-CCPA US state", async () => {
    const onCCPAUser = vi.fn();

    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "Texas"),
      version: "1.0",
      onCCPAUser,
    });

    await manager.init();

    expect(onCCPAUser).not.toHaveBeenCalled();
  });

  it("persists CCPA consent to cookie", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    // CCPA consent should be stored in cookie
    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    expect(stored.categories).toEqual({
      analytics: true,
      marketing: true,
      functional: true,
    });
    expect(stored.region).toBe("California");
    expect(stored.countryCode).toBe("US");
    expect(stored.isEU).toBe(false);
  });

  it("runs geo detection for GDPR roaming check when CCPA consent exists", async () => {
    // Pre-fill cookie with CCPA consent (isEU=false)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        isEU: false,
        geoMethod: "worker",
        countryCode: "US",
        region: "California",
      })
    )}`;

    // Geo returns same location (not roaming to EU)
    const geoDetector = createMockGeoDetector(false, "US", "California");
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector,
      version: "1.0",
    });
    await manager.init();

    // Geo detector IS called for GDPR roaming check (even for CCPA consent)
    expect(geoDetector.detect).toHaveBeenCalled();
    // Consent preserved since user is still in non-EU location
    expect(manager.hasConsent()).toBe(true);
    expect(manager.getRegion()).toBe("California");
  });
});

describe("ConsentManager region persistence", () => {
  it("stores region in cookie when saving preferences", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();
    await manager.savePreferences({ analytics: true, marketing: false });

    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    expect(stored.region).toBe("California");
    expect(stored.countryCode).toBe("US");
    expect(stored.isEU).toBe(false);
  });

  it("restores region from geo detection when consent has isEU=false", async () => {
    // Cookie with isEU=false triggers roaming check
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        isEU: false,
        geoMethod: "worker",
        countryCode: "US",
        region: "Virginia",
      })
    )}`;

    // Geo detection returns current location (same region)
    const geoDetector = createMockGeoDetector(false, "US", "Virginia");
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    await manager.init();

    // Region comes from geo detection (roaming check was run)
    expect(manager.getRegion()).toBe("Virginia");
    expect(manager.getGeoResult()?.region).toBe("Virginia");
  });

  it("includes region in geo detection log", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US", "Colorado"),
      version: "1.0",
    });
    await manager.init();

    const log = manager.getGeoDetectionLog();
    expect(log.length).toBe(1);
    expect(log[0].result?.region).toBe("Colorado");
  });
});
