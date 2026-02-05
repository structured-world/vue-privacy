// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getConsentUid,
  setConsentUid,
  clearConsentUid,
  fetchRemoteConsent,
  pushRemoteConsent,
  createKVStorage,
} from "../core/storage";

// Mock document.cookie
let cookieStore = "";

beforeEach(() => {
  cookieStore = "";
  Object.defineProperty(document, "cookie", {
    get: () => cookieStore,
    set: (value: string) => {
      // Parse the cookie being set
      const [nameValue] = value.split(";");
      const [name] = nameValue.split("=");

      // Check if it's a deletion (expires in the past)
      if (value.includes("1970")) {
        // Remove this cookie
        const cookies = cookieStore
          .split(";")
          .map((c) => c.trim())
          .filter((c) => !c.startsWith(`${name}=`));
        cookieStore = cookies.join("; ");
      } else {
        // Add/update cookie
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
});

describe("getConsentUid", () => {
  it("returns null when no consent_uid cookie exists", () => {
    expect(getConsentUid()).toBeNull();
  });

  it("reads consent_uid from cookie", () => {
    cookieStore = "consent_uid=abc-123-def";
    expect(getConsentUid()).toBe("abc-123-def");
  });
});

describe("setConsentUid", () => {
  it("sets consent_uid cookie with default config", () => {
    setConsentUid("test-uid-456", {});
    expect(getConsentUid()).toBe("test-uid-456");
  });

  it("respects custom cookie path", () => {
    setConsentUid("uid-custom", { cookie: { path: "/app" } });
    // Cookie is set (verified by checking cookieStore contains it)
    expect(cookieStore).toContain("consent_uid=uid-custom");
  });
});

describe("clearConsentUid", () => {
  it("removes consent_uid cookie", () => {
    setConsentUid("uid-to-remove", {});
    expect(getConsentUid()).toBe("uid-to-remove");
    clearConsentUid({});
    expect(getConsentUid()).toBeNull();
  });
});

describe("fetchRemoteConsent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns consent when KV has matching data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          found: true,
          consent: {
            categories: { analytics: true, marketing: false, functional: true },
            version: "1.0",
            timestamp: 1700000000000,
          },
        })
      )
    );

    const result = await fetchRemoteConsent("/api/consent", "uid-123", "1.0");
    expect(result).not.toBeNull();
    expect(result!.categories.analytics).toBe(true);
    expect(result!.categories.marketing).toBe(false);
    expect(result!.version).toBe("1.0");

    expect(fetch).toHaveBeenCalledWith("/api/consent?id=uid-123");
  });

  it("returns null when not found in KV", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ found: false })));

    const result = await fetchRemoteConsent("/api/consent", "uid-999", "1.0");
    expect(result).toBeNull();
  });

  it("returns null when version mismatch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          found: true,
          consent: {
            categories: { analytics: true, marketing: false, functional: true },
            version: "0.9",
          },
        })
      )
    );

    const result = await fetchRemoteConsent("/api/consent", "uid-123", "1.0");
    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await fetchRemoteConsent("/api/consent", "uid-123", "1.0");
    expect(result).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const result = await fetchRemoteConsent("/api/consent", "uid-123", "1.0");
    expect(result).toBeNull();
  });
});

describe("pushRemoteConsent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends consent to KV and returns generated UUID", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, id: "generated-uuid" }))
    );

    const consent = {
      categories: { analytics: true, marketing: false, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const id = await pushRemoteConsent("/api/consent", null, consent);
    expect(id).toBe("generated-uuid");

    // Verify POST body has no id when uid is null
    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]!.body as string);
    expect(body.id).toBeUndefined();
    expect(body.categories).toEqual(consent.categories);
    expect(body.version).toBe("1.0");
  });

  it("includes existing uid in POST body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, id: "existing-uid" }))
    );

    const consent = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const id = await pushRemoteConsent("/api/consent", "existing-uid", consent);
    expect(id).toBe("existing-uid");

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]!.body as string);
    expect(body.id).toBe("existing-uid");
  });

  it("returns null on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const consent = {
      categories: { analytics: false, marketing: false, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const id = await pushRemoteConsent("/api/consent", null, consent);
    expect(id).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    const consent = {
      categories: { analytics: false, marketing: false, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const id = await pushRemoteConsent("/api/consent", null, consent);
    expect(id).toBeNull();
  });
});

describe("createKVStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an object with get and set methods", () => {
    const storage = createKVStorage("/api/consent");
    expect(typeof storage.get).toBe("function");
    expect(typeof storage.set).toBe("function");
  });

  it("get() fetches consent from the provided URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          found: true,
          consent: {
            categories: { analytics: true, marketing: false, functional: true },
            version: "1.0",
            timestamp: 1700000000000,
          },
        })
      )
    );

    const storage = createKVStorage("/api/consent");
    const result = await storage.get("uid-abc", "1.0");

    expect(result).not.toBeNull();
    expect(result!.categories.analytics).toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/consent?id=uid-abc", { method: "GET" });
  });

  it("set() pushes consent to the provided URL and returns UUID", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, id: "new-uuid" }))
    );

    const storage = createKVStorage("/api/consent");
    const consent = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const id = await storage.set(null, consent);
    expect(id).toBe("new-uuid");

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toBe("/api/consent");
    expect(call[1]!.method).toBe("POST");
  });

  it("get() returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const storage = createKVStorage("/api/consent");
    const result = await storage.get("uid-123", "1.0");
    expect(result).toBeNull();
  });

  it("set() returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const storage = createKVStorage("/api/consent");
    const consent = {
      categories: { analytics: false, marketing: false, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const id = await storage.set(null, consent);
    expect(id).toBeNull();
  });
});

describe("createKVStorage rate limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("retries on 429 with exponential backoff (default 3 retries)", async () => {
    // First 2 calls return 429, third succeeds
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, id: "retry-success" })));

    const storage = createKVStorage("/api/consent");
    const consent = {
      categories: { analytics: true, marketing: false, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    // Start the set operation
    const setPromise = storage.set(null, consent);

    // First attempt fails with 429, waits 1s (2^0 * 1000)
    await vi.advanceTimersByTimeAsync(1000);

    // Second attempt fails with 429, waits 2s (2^1 * 1000)
    await vi.advanceTimersByTimeAsync(2000);

    // Third attempt succeeds
    const id = await setPromise;

    expect(id).toBe("retry-success");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("respects Retry-After header when present", async () => {
    // Return 429 with Retry-After: 5 (seconds)
    const headers = new Headers();
    headers.set("Retry-After", "5");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 429, headers }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, id: "after-retry" })));

    const storage = createKVStorage("/api/consent");
    const consent = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const setPromise = storage.set(null, consent);

    // Should wait 5 seconds as specified in Retry-After header
    await vi.advanceTimersByTimeAsync(5000);

    const id = await setPromise;
    expect(id).toBe("after-retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null after max retries exhausted", async () => {
    // All 3 attempts return 429
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 429 }));

    const storage = createKVStorage("/api/consent");
    const consent = {
      categories: { analytics: false, marketing: false, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const setPromise = storage.set(null, consent);

    // Wait for all retry delays: 1s + 2s = 3s (no wait after 3rd attempt)
    await vi.advanceTimersByTimeAsync(1000); // After 1st retry
    await vi.advanceTimersByTimeAsync(2000); // After 2nd retry

    const id = await setPromise;

    // Should return null (graceful fallback to local storage)
    expect(id).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("calls onRateLimited callback on each 429 response", async () => {
    const headers = new Headers();
    headers.set("Retry-After", "10");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 429, headers }))
      .mockResolvedValueOnce(new Response(null, { status: 429 })) // No Retry-After
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, id: "callback-test" })));

    const onRateLimited = vi.fn();
    const storage = createKVStorage("/api/consent", { onRateLimited });
    const consent = {
      categories: { analytics: true, marketing: false, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const setPromise = storage.set(null, consent);

    // First 429 with Retry-After: 10
    await vi.advanceTimersByTimeAsync(10000);

    // Second 429 without Retry-After (exponential: 2s)
    await vi.advanceTimersByTimeAsync(2000);

    await setPromise;

    // Callback should be called twice (once per 429)
    expect(onRateLimited).toHaveBeenCalledTimes(2);
    expect(onRateLimited).toHaveBeenNthCalledWith(1, 10, 1); // retryAfter=10, attempt=1
    expect(onRateLimited).toHaveBeenNthCalledWith(2, null, 2); // retryAfter=null, attempt=2
  });

  it("supports custom maxRetries option", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, id: "custom-retry" })));

    const storage = createKVStorage("/api/consent", { maxRetries: 2 });
    const consent = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const setPromise = storage.set(null, consent);
    await vi.advanceTimersByTimeAsync(1000);

    const id = await setPromise;
    expect(id).toBe("custom-retry");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries GET requests on 429", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            found: true,
            consent: {
              categories: { analytics: true, marketing: false, functional: true },
              version: "1.0",
              timestamp: 1700000000000,
            },
          })
        )
      );

    const storage = createKVStorage("/api/consent");
    const getPromise = storage.get("uid-retry", "1.0");

    await vi.advanceTimersByTimeAsync(1000);

    const result = await getPromise;
    expect(result).not.toBeNull();
    expect(result!.categories.analytics).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("makes at least one attempt even if maxRetries is 0", async () => {
    // Even with maxRetries=0, should make at least 1 attempt
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, id: "zero-retries" }))
    );

    const storage = createKVStorage("/api/consent", { maxRetries: 0 });
    const consent = {
      categories: { analytics: true, marketing: false, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const id = await storage.set(null, consent);
    expect(id).toBe("zero-retries");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("caps excessive Retry-After values to prevent long waits", async () => {
    // Server returns Retry-After: 999999 (would be ~277 hours without cap)
    const headers = new Headers();
    headers.set("Retry-After", "999999");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 429, headers }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, id: "capped-delay" })));

    const storage = createKVStorage("/api/consent");
    const consent = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };

    const setPromise = storage.set(null, consent);

    // Should be capped to 30 seconds (MAX_RETRY_DELAY_MS) instead of 999999 seconds
    await vi.advanceTimersByTimeAsync(30_000);

    const id = await setPromise;
    expect(id).toBe("capped-delay");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
