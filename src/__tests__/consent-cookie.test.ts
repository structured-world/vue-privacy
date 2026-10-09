// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsentManager } from "../core/consent-manager";
import { installCookieJar } from "./helpers/cookie-jar";
import type { ConsentConfig, GeoDetectionResult } from "../core/types";

// The consent cookie is set without consent as strictly necessary storage (ePrivacy Directive
// 2002/58/EC, Art. 5(3)): it remembers the visitor's choice and nothing else. The visitor's
// country, region and detection method are personal data that exemption does not cover, and the
// cookie travels with every request to the site.

const CONSENT_FIELDS = ["categories", "consentRequired", "timestamp", "version"];

let cookieStore = "";
let writes: string[] = [];

beforeEach(() => {
  cookieStore = "";
  writes = [];
  installCookieJar(
    () => cookieStore,
    (jar) => {
      cookieStore = jar;
    },
    (value) => writes.push(value)
  );
  vi.restoreAllMocks();
});

/** The JSON of every write of the consent cookie (deletions excluded). */
function consentWrites(): Record<string, unknown>[] {
  return writes
    .filter((w) => w.startsWith("consent_preferences=") && !/expires=Thu, 01 Jan 1970/i.test(w))
    .map((w) =>
      JSON.parse(decodeURIComponent(w.split(";")[0].slice("consent_preferences=".length)))
    );
}

function detecting(result: GeoDetectionResult): ConsentConfig["geoDetector"] {
  return { detect: vi.fn().mockResolvedValue(result) };
}

async function started(config: ConsentConfig): Promise<ConsentManager> {
  const manager = new ConsentManager({ version: "1.0", ...config });
  await manager.init();
  return manager;
}

describe("the consent cookie", () => {
  it("stores the choice without the visitor's location", async () => {
    // Regression: countryCode, region and geoMethod were written into the cookie with every
    // choice, though nothing decides on them.
    const manager = await started({
      geoDetector: detecting({
        consentRequired: true,
        countryCode: "DE",
        region: "Bavaria",
        method: "api",
      }),
    });

    await manager.rejectAll();

    const written = consentWrites();
    expect(written.length).toBeGreaterThan(0);
    for (const record of written) expect(Object.keys(record).sort()).toEqual(CONSENT_FIELDS);
    expect(manager.getConsent()).not.toHaveProperty("countryCode");
  });

  it("refreshes a choice made outside without writing the location", async () => {
    // The location check of a choice stored outside consent jurisdictions rewrote the cookie
    // with the freshly detected country and region.
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: 1,
        version: "1.0",
      })
    )}`;

    await started({
      geoDetector: detecting({
        consentRequired: false,
        countryCode: "US",
        region: "California",
        method: "api",
      }),
    });

    for (const record of consentWrites()) {
      expect(Object.keys(record).sort()).toEqual(CONSENT_FIELDS);
    }
  });

  it("rewrites a cookie of an earlier version without its location, keeping the choice", async () => {
    // Cookies already on visitors' devices carry the location (and the flag as isEU); they are
    // cleaned on the first page load, with the same timestamp, so other tabs see no new choice.
    const timestamp = Date.now() - 1000;
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: false, marketing: false, functional: true },
        timestamp,
        version: "1.0",
        isEU: true,
        geoMethod: "worker",
        countryCode: "DE",
        region: "Bavaria",
      })
    )}`;
    const detect = vi.fn();

    const manager = await started({ geoDetector: { detect } });

    expect(detect).not.toHaveBeenCalled();
    expect(consentWrites()).toEqual([
      {
        categories: { analytics: false, marketing: false, functional: true },
        timestamp,
        version: "1.0",
        consentRequired: true,
      },
    ]);
    expect(manager.getConsent()?.categories.analytics).toBe(false);
  });

  it("deletes a cookie of an earlier version and configuration that still holds a location", async () => {
    // Regression: a cookie for another consent version is no consent, so it was neither
    // restored nor rewritten; a visitor outside consent jurisdictions is granted without a
    // write, and the location travelled with every request until the cookie expired.
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "0.9",
        isEU: false,
        countryCode: "US",
        region: "California",
      })
    )}`;

    await started({
      geoDetector: detecting({ consentRequired: false, countryCode: "US", method: "api" }),
    });

    expect(cookieStore).not.toContain("consent_preferences=");
  });

  it("keeps the remaining lifetime of a migrated cookie", async () => {
    // Regression: the rewrite set the full lifetime again, keeping a choice made 300 days ago
    // for another 365 days.
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: false, marketing: false, functional: true },
        timestamp: now - 300 * day,
        version: "1.0",
        isEU: true,
      })
    )}`;

    await started({ geoDetector: { detect: vi.fn() } });

    const write = writes.find((w) => w.startsWith("consent_preferences="));
    const expires = Date.parse(/expires=([^;]+)/.exec(write ?? "")?.[1] ?? "");
    expect(Math.abs(expires - (now + 65 * day))).toBeLessThan(day);
  });

  it("deletes a migrated cookie whose lifetime has run out", async () => {
    // A choice older than the configured lifetime is not kept: the visitor is asked again.
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: false, marketing: false, functional: true },
        timestamp: Date.now() - 400 * 24 * 60 * 60 * 1000,
        version: "1.0",
        isEU: true,
      })
    )}`;

    const manager = await started({
      geoDetector: detecting({ consentRequired: true, countryCode: "DE", method: "api" }),
    });

    expect(cookieStore).not.toContain("consent_preferences=");
    expect(manager.getConsent()).toBeNull();
  });

  it("leaves a cookie of the current format as it is on load", async () => {
    // A rewrite on every load would restart the cookie's lifetime with each visit.
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: false, marketing: false, functional: true },
        timestamp: 42,
        version: "1.0",
        consentRequired: true,
      })
    )}`;

    await started({ geoDetector: { detect: vi.fn() } });

    expect(consentWrites()).toEqual([]);
  });

  it("reports a choice restored without a lookup as coming from the stored choice", async () => {
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: 42,
        version: "1.0",
        consentRequired: true,
      })
    )}`;

    const manager = await started({ geoDetector: { detect: vi.fn() } });

    expect(manager.getGeoResult()).toEqual({ consentRequired: true, method: "stored" });
    expect(manager.getGeoDetectionLog()).toEqual([
      { method: "stored", status: "success", result: { consentRequired: true }, duration: 0 },
    ]);
  });
});
