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

  it("returns null when consent restored from cookie (geo detection skipped)", async () => {
    // Pre-set consent cookie so init() takes fast-path
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: true, marketing: false, functional: true }, timestamp: Date.now(), version: "1.0" }))}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    // Geo detection was skipped — geoResult should be null
    expect(manager.getGeoResult()).toBeNull();
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
    // Pre-set consent with analytics=false
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: false, marketing: false, functional: true }, timestamp: Date.now(), version: "1.0" }))}`;

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
