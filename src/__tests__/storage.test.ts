// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getConsentUid,
  setConsentUid,
  clearConsentUid,
  fetchRemoteConsent,
  pushRemoteConsent,
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
